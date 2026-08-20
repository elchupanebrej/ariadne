import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
  EdgeSchema,
  type EpistemicEdge,
} from "../core/schemas/edges.js";
import {
  NodeSchema,
  type Node,
} from "../core/schemas/nodes.js";
import { validateGraph } from "./integrity.js";

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

// ponytail: process-local per-path queue; use an OS/file lock if multiple processes append concurrently.
const pathQueues = new Map<string, Promise<void>>();

const enqueue = (path: string, operation: () => Promise<void>): Promise<void> => {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pathQueues.set(path, current);

  return current.finally(() => {
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  });
};

const edgeKey = (edge: Pick<EpistemicEdge, "source" | "type" | "target">): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

const applyEvents = (
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

export function renderIndex(graph: MaterializedGraph): string {
  const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const active = nodes.filter((node) => node.status !== "INVALIDATED");
  const unknowns = nodes.filter((node) => node.type === "UNK");
  const candidates = nodes.filter((node) => node.type === "CAN");
  const rows = active.slice(0, 25).map(
    (node) =>
      `| ${node.id} | ${node.provenance_type} | ${node.status ?? "ACTIVE"} | ${compact(node.statement)} |`,
  );

  return [
    "# Ariadne Epistemic Index",
    "",
    `Nodes: ${nodes.length} · Edges: ${graph.edges.length} · Active: ${active.length}`,
    `Unknowns: ${unknowns.length} · Candidates: ${candidates.length}`,
    "",
    "## Frontier",
    "",
    "| ID | Provenance | Status | Statement |",
    "| --- | --- | --- | --- |",
    ...(rows.length > 0 ? rows : ["| — | — | — | No active nodes |"]),
    "",
  ].join("\n");
}

export class GraphStorage {
  readonly rootDirectory: string;
  readonly statePath: string;
  readonly graphPath: string;
  readonly indexPath: string;

  constructor(rootDirectory = ".ariadne") {
    this.rootDirectory = rootDirectory;
    this.statePath = join(rootDirectory, "STATE.yaml");
    this.graphPath = join(rootDirectory, "GRAPH.jsonl");
    this.indexPath = join(rootDirectory, "INDEX.md");
  }

  async readState<T = unknown>(): Promise<T | null> {
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
  }

  async writeState(state: unknown): Promise<void> {
    const parsed = StateSchema.safeParse(state);
    if (!parsed.success) throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
    const serialized = JSON.stringify(parsed.data, null, 2);
    if (serialized === undefined) throw new TypeError("State must be JSON-serializable");

    await enqueue(this.statePath, async () => {
      await mkdir(dirname(this.statePath), { recursive: true });
      const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${serialized}\n`, "utf8");
      await rename(temporaryPath, this.statePath);
    });
  }

  async appendEvent(event: unknown): Promise<void> {
    await this.appendEvents([event]);
  }

  async appendEvents(events: readonly unknown[]): Promise<void> {
    const parsed = events.map((event) => GraphEventSchema.parse(event));
    if (parsed.length === 0) return;

    await enqueue(this.graphPath, async () => {
      const current = await this.materialize();
      const prospective = applyEvents(current, parsed);
      const validation = validateGraph(prospective);
      if (!validation.valid) {
        throw new Error(
          `Invalid graph after append: ${validation.diagnostics
            .map(({ code, message }) => code === "MISSING_NODE" ? `Missing node reference: ${message}` : message)
            .join("; ")}`,
        );
      }

      await mkdir(dirname(this.graphPath), { recursive: true });
      await appendFile(
        this.graphPath,
        `${parsed.map((event) => JSON.stringify(event)).join("\n")}\n`,
        "utf8",
      );
      await this.writeIndexUnlocked();
    });
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

  async readEvents(): Promise<GraphEvent[]> {
    let contents: string;
    try {
      contents = await readFile(this.graphPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    return contents
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => GraphEventSchema.parse(JSON.parse(line)));
  }

  async materialize(): Promise<MaterializedGraph> {
    return applyEvents({ nodes: [], edges: [] }, await this.readEvents());
  }

  async readGraph(): Promise<MaterializedGraph> {
    return this.materialize();
  }

  async regenerateIndex(): Promise<void> {
    await enqueue(this.indexPath, () => this.writeIndexUnlocked());
  }

  private async writeIndexUnlocked(): Promise<void> {
    await mkdir(dirname(this.indexPath), { recursive: true });
    await writeFile(this.indexPath, renderIndex(await this.materialize()), "utf8");
  }
}

export const StorageManager = GraphStorage;

export function createGraphStorage(rootDirectory = ".ariadne"): GraphStorage {
  return new GraphStorage(rootDirectory);
}
