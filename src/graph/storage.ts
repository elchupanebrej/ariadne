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

export type MaterializedGraph = {
  nodes: Node[];
  edges: EpistemicEdge[];
};

export const GraphEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), node: NodeSchema }),
  z.object({ kind: z.literal("edge"), edge: EdgeSchema }),
]);

export type GraphEvent = z.infer<typeof GraphEventSchema>;

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
      return JSON.parse(await readFile(this.statePath, "utf8")) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async writeState(state: unknown): Promise<void> {
    const serialized = JSON.stringify(state, null, 2);
    if (serialized === undefined) throw new TypeError("State must be JSON-serializable");

    await enqueue(this.statePath, async () => {
      await mkdir(dirname(this.statePath), { recursive: true });
      const temporaryPath = `${this.statePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${serialized}\n`, "utf8");
      await rename(temporaryPath, this.statePath);
    });
  }

  async appendEvent(event: unknown): Promise<void> {
    const parsed = GraphEventSchema.parse(event);
    const serialized = `${JSON.stringify(parsed)}\n`;

    await enqueue(this.graphPath, async () => {
      await mkdir(dirname(this.graphPath), { recursive: true });
      await appendFile(this.graphPath, serialized, "utf8");
      // ponytail: regenerate per event; add a batch append API if write volume matters.
      await this.writeIndexUnlocked();
    });
  }

  async appendNode(node: unknown): Promise<void> {
    await this.appendEvent({ kind: "node", node: NodeSchema.parse(node) });
  }

  async appendEdge(edge: unknown): Promise<void> {
    await this.appendEvent({ kind: "edge", edge: EdgeSchema.parse(edge) });
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
    const nodes = new Map<string, Node>();
    const edges = new Map<string, EpistemicEdge>();

    for (const event of await this.readEvents()) {
      if (event.kind === "node") {
        nodes.set(event.node.id, event.node);
      } else {
        const key = `${event.edge.source}\u0000${event.edge.type}\u0000${event.edge.target}`;
        edges.set(key, event.edge);
      }
    }

    return {
      nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
      edges: [...edges.values()].sort((left, right) =>
        `${left.source}\u0000${left.type}\u0000${left.target}`.localeCompare(
          `${right.source}\u0000${right.type}\u0000${right.target}`,
        ),
      ),
    };
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
