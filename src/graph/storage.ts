import {
  appendFile,
  access,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  truncate,
  writeFile,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
  EdgeSchema,
  type EpistemicEdge,
} from "../core/schemas/edges.js";
import { createFramedRecord } from "./journal.js";
import {
  NodeSchema,
  type Node,
} from "../core/schemas/nodes.js";
import type { ProvenanceType } from "../core/types/nodes.js";
import { validateGraph } from "./integrity.js";
import { assertWithinCapacity } from "./capacity.js";

export type MaterializedGraph = {
  nodes: Node[];
  edges: EpistemicEdge[];
};

export const GraphEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), node: NodeSchema }),
  z.object({
    kind: z.literal("edge"),
    edge: EdgeSchema,
    tombstone: z.literal(true).optional(),
  }),
]);

export type GraphEvent = z.infer<typeof GraphEventSchema>;

const StateIdSchema = z.string().regex(/^[A-Z][A-Z0-9-]*-[0-9A-Za-z_-]+$/u);
const StateReferenceSchema = z.union([
  StateIdSchema,
  z.object({ id: StateIdSchema }).passthrough(),
]);

/**
 * STATE.yaml is JSON-compatible by design, with a strict Ariadne-owned core
 * and passthrough fields for host/GSD overlay metadata.
 */
export const StateSchema = z
  .object({
    schema_version: z.number().int().positive().optional(),
    mode: z.enum(["standalone", "gsd"]).optional(),
    depth_mode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    active_depth_mode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    depthMode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    frontier: z.array(StateReferenceSchema).optional(),
    active_frontier: z.array(StateReferenceSchema).optional(),
    open_unknowns: z.array(StateReferenceSchema).optional(),
    openUnknowns: z.array(StateReferenceSchema).optional(),
    unknowns: z.array(StateReferenceSchema).optional(),
    active_notices: z.array(z.string().regex(/^NOT-[0-9A-Za-z_-]+$/u)).optional(),
    last_invalidation: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type AriadneState = z.infer<typeof StateSchema>;

// The queue handles same-process callers; the directory lock below covers other processes.
const pathQueues = new Map<string, Promise<unknown>>();

const enqueue = <T>(path: string, operation: () => Promise<T>): Promise<T> => {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pathQueues.set(path, current);

  return current.finally(() => {
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  });
};

const LOCK_WAIT_MS = 10;
const LOCK_STALE_MS = 5 * 60_000;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withFileLock = async <T>(
  lockPath: string,
  operation: () => Promise<T>,
): Promise<T> => {
  await mkdir(dirname(lockPath), { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      await writeFile(join(lockPath, "owner"), `${process.pid}\n`, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const age = Date.now() - (await stat(lockPath)).mtimeMs;
        if (age > LOCK_STALE_MS) await rm(lockPath, { recursive: true, force: true });
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
      }
      if (Date.now() - startedAt > LOCK_STALE_MS) {
        throw new Error(`Timed out waiting for storage lock: ${lockPath}`);
      }
      await sleep(LOCK_WAIT_MS);
    }
  }

  try {
    return await operation();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
};

export const edgeKey = (edge: Pick<EpistemicEdge, "source" | "type" | "target">): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

export const applyEvents = (
  graph: MaterializedGraph,
  events: readonly GraphEvent[],
): MaterializedGraph => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));

  for (const event of events) {
    if (event.kind === "node") nodes.set(event.node.id, event.node);
    else if (event.tombstone) edges.delete(edgeKey(event.edge));
    else edges.set(edgeKey(event.edge), event.edge);
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) =>
      edgeKey(left).localeCompare(edgeKey(right)),
    ),
  };
};

const compact = (value: string, limit = 100): string => {
  const oneLine = value.replace(/\s+/g, " ").replaceAll("|", "\\|").trim();
  return oneLine.length > limit ? `${oneLine.slice(0, limit - 1)}…` : oneLine;
};

export const TERMINAL_NODE_STATUSES = new Set([
  "RESOLVED",
  "REJECTED",
  "INVALIDATED",
  "REMOVED",
  "DECIDED",
]);

export const isTerminalNode = (
  node: { provenance_type: ProvenanceType; status?: string; tombstone?: boolean },
): boolean => {
  if (node.tombstone) return true;
  if (node.provenance_type === "DECIDED") return true;
  if (
    typeof node.status === "string" &&
    TERMINAL_NODE_STATUSES.has(node.status.toUpperCase().replaceAll("-", "_"))
  ) {
    return true;
  }
  return false;
};

export const isFrontierNode = (
  node: { provenance_type: ProvenanceType; status?: string; tombstone?: boolean },
): boolean => !isTerminalNode(node);

export const stateForGraph = (
  state: Record<string, unknown>,
  graph: MaterializedGraph,
): Record<string, unknown> => {
  const frontierNodes = graph.nodes.filter(isFrontierNode);
  const frontier = frontierNodes.map((node) => node.id);
  const openUnknowns = frontierNodes
    .filter((node) => node.type === "UNK")
    .map((node) => node.id);
  const next: Record<string, unknown> = { ...state, frontier, open_unknowns: openUnknowns };
  if ("active_frontier" in state) next.active_frontier = frontier;
  if ("openUnknowns" in state) next.openUnknowns = openUnknowns;
  if ("unknowns" in state) next.unknowns = openUnknowns;
  return next;
};

export function renderIndex(graph: MaterializedGraph): string {
  const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const frontierNodes = nodes.filter(isFrontierNode);
  const activeNodes = nodes.filter(
    (node) => node.status !== "INVALIDATED" && node.status !== "REMOVED",
  );
  const unknowns = nodes.filter((node) => node.type === "UNK");
  const candidates = nodes.filter((node) => node.type === "CAN");
  const limit = 25;
  const renderedFrontier = frontierNodes.slice(0, limit);
  const omitted = frontierNodes.length - renderedFrontier.length;
  const rows = renderedFrontier.map(
    (node) =>
      `| ${node.id} | ${node.provenance_type} | ${node.status ?? "ACTIVE"} | ${compact(node.statement)} |`,
  );

  const lines = [
    "# Ariadne Epistemic Index",
    "",
    `Nodes: ${nodes.length} · Edges: ${graph.edges.length} · Active: ${activeNodes.length}`,
    `Unknowns: ${unknowns.length} · Candidates: ${candidates.length}`,
    "",
    "## Frontier",
    "",
    "| ID | Provenance | Status | Statement |",
    "| --- | --- | --- | --- |",
    ...(rows.length > 0 ? rows : ["| — | — | — | No active nodes |"]),
    "",
  ];

  if (omitted > 0) {
    lines.push(`*Omitted ${omitted} additional frontier nodes for compactness.*`, "");
  }

  return lines.join("\n");
}

const CARD_HEADER_FIELDS = new Set([
  "id",
  "type",
  "provenance_type",
  "statement",
  "title",
  "status",
  "tombstone",
]);

export function renderCard(node: Node): string {
  const status = node.status ?? "ACTIVE";
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).filter(([key]) => !CARD_HEADER_FIELDS.has(key)),
  );
  const payloadLines =
    Object.keys(payload).length > 0
      ? [
          "",
          "## Payload",
          "",
          "```json",
          JSON.stringify(payload, null, 2),
          "```",
          "",
        ]
      : [""];

  return [
    `# ${node.id}${node.title ? `: ${node.title}` : ""}`,
    "",
    `- Status: ${status}`,
    `- Provenance: ${node.provenance_type}`,
    `- Type: ${node.type}`,
    `- Revised: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Statement",
    "",
    node.statement,
    ...payloadLines,
  ].join("\n");
}

export class GraphStorage {
  readonly rootDirectory: string;
  readonly statePath: string;
  readonly graphPath: string;
  readonly indexPath: string;
  readonly cardsDirectory: string;
  readonly graphLockPath: string;
  readonly stateLockPath: string;

  constructor(rootDirectory = ".ariadne") {
    this.rootDirectory = rootDirectory;
    this.statePath = join(rootDirectory, "STATE.yaml");
    this.graphPath = join(rootDirectory, "GRAPH.jsonl");
    this.indexPath = join(rootDirectory, "INDEX.md");
    this.cardsDirectory = join(rootDirectory, "cards");
    this.graphLockPath = `${this.graphPath}.lock`;
    this.stateLockPath = `${this.statePath}.lock`;
  }

  async readState<T = unknown>(): Promise<T | null> {
    return enqueue(this.statePath, () =>
      withFileLock(this.stateLockPath, async () => {
        try {
          const value: unknown = JSON.parse(await readFile(this.statePath, "utf8"));
          const parsed = StateSchema.safeParse(value);
          if (!parsed.success) {
            throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
          }
          return parsed.data as T;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw error;
        }
      }),
    );
  }

  async writeState(state: unknown): Promise<void> {
    const parsed = StateSchema.safeParse(state);
    if (!parsed.success) throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
    const serialized = JSON.stringify(parsed.data, null, 2);
    if (serialized === undefined) throw new TypeError("State must be JSON-serializable");

    await enqueue(this.statePath, () =>
      withFileLock(this.stateLockPath, async () => {
        await mkdir(dirname(this.statePath), { recursive: true });
        const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
        await writeFile(temporaryPath, `${serialized}\n`, "utf8");
        await rename(temporaryPath, this.statePath);
      }),
    );
  }

  async transaction<T>(
    mutate: (
      graph: MaterializedGraph,
    ) =>
      | { result: T; events: readonly unknown[] }
      | Promise<{ result: T; events: readonly unknown[] }>,
  ): Promise<T> {
    return enqueue(this.graphPath, () =>
      withFileLock(this.graphLockPath, async () => {
        const current = applyEvents({ nodes: [], edges: [] }, await this.readEventsUnlocked(true));
        const mutation = await mutate(current);
        const parsed = mutation.events.map((event) => GraphEventSchema.parse(event));
        if (parsed.length === 0) return mutation.result;

        const prospective = applyEvents(current, parsed);
        const validation = validateGraph(prospective);
        if (!validation.valid) {
          throw new Error(
            `Invalid graph after append: ${validation.diagnostics
              .map(({ code, message }) =>
                code === "MISSING_NODE" ? `Missing node reference: ${message}` : message,
              )
              .join("; ")}`,
          );
        }

        await mkdir(dirname(this.graphPath), { recursive: true });
        let currentContents = "";
        try {
          currentContents = await readFile(this.graphPath, "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (currentContents && !currentContents.endsWith("\n")) {
          currentContents += "\n";
        }
        const existingLines = currentContents.split("\n").filter((l) => l.trim().length > 0);
        assertWithinCapacity({
          nodeCount: prospective.nodes.length,
          edgeCount: prospective.edges.length,
          eventCount: existingLines.length + parsed.length,
        });
        const startSeq = existingLines.length;
        const framedLines = parsed.map((event, idx) =>
          JSON.stringify(createFramedRecord({ payload: event, sequence: startSeq + idx + 1 })),
        );
        const temporaryPath = `${this.graphPath}.${randomUUID()}.tmp`;
        try {
          await writeFile(
            temporaryPath,
            `${currentContents}${framedLines.join("\n")}\n`,
            "utf8",
          );
          await rename(temporaryPath, this.graphPath);
        } finally {
          await rm(temporaryPath, { force: true });
        }
        await this.writeIndexUnlocked(prospective);
        await this.writeCardsUnlocked(parsed);
        if (parsed.some((event) => event.kind === "node")) {
          await this.syncStateWithGraph(prospective);
        }
        return mutation.result;
      }),
    );
  }

  private async syncStateWithGraph(graph: MaterializedGraph): Promise<void> {
    let existing: unknown = {};
    try {
      existing = JSON.parse(await readFile(this.statePath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // Fresh workspace: create the state file so frontier and open-unknown
      // state exist for the next session instead of silently skipping.
    }
    await enqueue(this.statePath, () =>
      withFileLock(this.stateLockPath, async () => {
        const parsed = StateSchema.safeParse(existing);
        if (!parsed.success) throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
        const serialized = JSON.stringify(
          stateForGraph(parsed.data as Record<string, unknown>, graph),
          null,
          2,
        );
        const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
        await mkdir(dirname(this.statePath), { recursive: true });
        try {
          await writeFile(temporaryPath, `${serialized}\n`, "utf8");
          await rename(temporaryPath, this.statePath);
        } finally {
          await rm(temporaryPath, { force: true });
        }
      }),
    );
  }

  async appendEvent(event: unknown): Promise<void> {
    await this.appendEvents([event]);
  }

  async appendEvents(events: readonly unknown[]): Promise<void> {
    await this.transaction(() => ({ result: undefined, events }));
  }

  async appendNode(node: unknown): Promise<void> {
    await this.appendEvent({ kind: "node", node: NodeSchema.parse(node) });
  }

  async appendEdge(edge: unknown): Promise<void> {
    await this.appendEvent({ kind: "edge", edge: EdgeSchema.parse(edge) });
  }

  async appendEdgeTombstone(edge: unknown): Promise<void> {
    await this.appendEvent({
      kind: "edge",
      edge: EdgeSchema.parse(edge),
      tombstone: true,
    });
  }

  private async readEventsUnlocked(recoverPartialTail: boolean): Promise<GraphEvent[]> {
    let contents: string;
    try {
      contents = await readFile(this.graphPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const hasFinalNewline = contents.endsWith("\n");
    const lines = contents.split("\n");
    if (hasFinalNewline) lines.pop();
    const events: GraphEvent[] = [];
    const lastMeaningfulIndex = lines.reduce(
      (last, line, index) => (line.trim() ? index : last),
      -1,
    );
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line || !line.trim()) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch (error) {
        const isPartialTail = index === lastMeaningfulIndex;
        if (!recoverPartialTail || !isPartialTail) throw error;
        const offset = Buffer.byteLength(lines.slice(0, index).join("\n"));
        await truncate(this.graphPath, offset === 0 ? 0 : offset + 1);
        return events;
      }
      const candidate =
        value && typeof value === "object" && "schemaVersion" in value && "payload" in value
          ? (value as { payload: unknown }).payload
          : value;
      events.push(GraphEventSchema.parse(candidate));
    }
    if (recoverPartialTail && !hasFinalNewline && lastMeaningfulIndex >= 0) {
      await appendFile(this.graphPath, "\n", "utf8");
    }
    return events;
  }

  async readEvents(): Promise<GraphEvent[]> {
    return enqueue(this.graphPath, () =>
      withFileLock(this.graphLockPath, () => this.readEventsUnlocked(true)),
    );
  }

  async materialize(): Promise<MaterializedGraph> {
    return applyEvents({ nodes: [], edges: [] }, await this.readEvents());
  }

  async readGraph(): Promise<MaterializedGraph> {
    return this.materialize();
  }

  async regenerateIndex(): Promise<void> {
    await enqueue(this.graphPath, () =>
      withFileLock(this.graphLockPath, async () => {
        const graph = applyEvents(
          { nodes: [], edges: [] },
          await this.readEventsUnlocked(true),
        );
        await this.writeIndexUnlocked(graph);
        await this.writeCardsUnlocked(
          graph.nodes.map((node) => ({ kind: "node" as const, node })),
        );
      }),
    );
  }

  private async writeIndexUnlocked(graph?: MaterializedGraph): Promise<void> {
    await mkdir(dirname(this.indexPath), { recursive: true });
    await writeFile(
      this.indexPath,
      renderIndex(graph ?? applyEvents({ nodes: [], edges: [] }, await this.readEventsUnlocked(true))),
      "utf8",
    );
  }

  private async writeCardsUnlocked(events: readonly GraphEvent[]): Promise<void> {
    const nodes = events.flatMap((event) => (event.kind === "node" ? [event.node] : []));
    if (nodes.length === 0) return;
    await mkdir(this.cardsDirectory, { recursive: true });
    await Promise.all(
      nodes.map((node) =>
        writeFile(join(this.cardsDirectory, `${node.id}.md`), renderCard(node), "utf8"),
      ),
    );
  }
}

export const StorageManager = GraphStorage;

export function createGraphStorage(rootDirectory = ".ariadne"): GraphStorage {
  return new GraphStorage(rootDirectory);
}
