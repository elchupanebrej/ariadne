import { join } from "node:path";
import { EdgeSchema } from "../core/schemas/edges.js";
import { NodeSchema } from "../core/schemas/nodes.js";
import { validateGraph } from "./integrity.js";
import { assertWithinCapacity } from "./capacity.js";
import { FileSystemStorageDriver } from "./storage-driver.js";
import { EpistemicGraph, type GraphBatch } from "./epistemic-graph.js";
import {
  applyEvents,
  GraphEventSchema,
  renderCard,
  renderIndex,
  stateForGraph,
  StateSchema,
  type GraphEvent,
  type MaterializedGraph,
} from "./domain.js";

export * from "./domain.js";

export class GraphStorage {
  readonly rootDirectory: string;
  readonly statePath: string;
  readonly graphPath: string;
  readonly indexPath: string;
  readonly cardsDirectory: string;
  readonly graphLockPath: string;
  readonly stateLockPath: string;
  private readonly driver: FileSystemStorageDriver;

  constructor(rootDirectory = ".ariadne") {
    this.rootDirectory = rootDirectory;
    this.statePath = join(rootDirectory, "STATE.yaml");
    this.graphPath = join(rootDirectory, "GRAPH.jsonl");
    this.indexPath = join(rootDirectory, "INDEX.md");
    this.cardsDirectory = join(rootDirectory, "cards");
    this.graphLockPath = join(rootDirectory, ".lock");
    this.stateLockPath = join(rootDirectory, ".lock");
    this.driver = new FileSystemStorageDriver(rootDirectory);
  }

  async readState<T = unknown>(): Promise<T | null> {
    const value = await this.driver.readState();
    if (value === null) return null;
    const parsed = StateSchema.safeParse(value);
    if (!parsed.success) throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
    const compatibilityState = { ...(parsed.data as Record<string, unknown>) };
    delete compatibilityState.schema_version;
    return compatibilityState as T;
  }

  async writeState(state: unknown): Promise<void> {
    const parsed = StateSchema.safeParse(state);
    if (!parsed.success) throw new Error(`Invalid STATE.yaml: ${parsed.error.message}`);
    await this.driver.writeState(parsed.data as Record<string, unknown>);
  }

  async writeStateProjection(content: string): Promise<void> {
    await this.driver.writeStateProjection(content);
  }

  async writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void> {
    await this.driver.writeCards(cards);
  }

  async deleteCard(id: string): Promise<void> {
    await this.driver.deleteCard(id);
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.driver.withLock(operation);
  }

  async transaction<T>(
    mutate: (
      graph: MaterializedGraph,
    ) =>
      | { result: T; events: readonly unknown[] }
      | Promise<{ result: T; events: readonly unknown[] }>,
  ): Promise<T> {
    return this.driver.withLock(async () => {
      const current = await this.materialize();
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

      const existingEvents = await this.readEvents();
      assertWithinCapacity({
        nodeCount: prospective.nodes.length,
        edgeCount: prospective.edges.length,
        eventCount: existingEvents.length + parsed.length,
      });

      await this.driver.appendEvents(parsed);
      await this.driver.writeIndex(renderIndex(prospective));
      await this.driver.writeCards(
        parsed.flatMap((event) =>
          event.kind === "node" ? [{ id: event.node.id, content: renderCard(event.node) }] : [],
        ),
      );
      if (parsed.some((event) => event.kind === "node")) {
        const previous = (await this.driver.readState()) ?? {};
        await this.driver.writeState(stateForGraph(previous, prospective));
      }
      return mutation.result;
    });
  }

  async batch<T>(operation: (batch: GraphBatch) => T | Promise<T>): Promise<T> {
    return EpistemicGraph.open(this.rootDirectory).batch(operation);
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

  async readEvents(): Promise<GraphEvent[]> {
    return (await this.driver.readEvents()).map((event) => GraphEventSchema.parse(event));
  }

  async materialize(): Promise<MaterializedGraph> {
    return applyEvents({ nodes: [], edges: [] }, await this.readEvents());
  }

  async readGraph(): Promise<MaterializedGraph> {
    return this.materialize();
  }

  async regenerateIndex(): Promise<void> {
    await this.driver.withProjectionLock(async () => {
      await this.regenerateIndexUnlocked();
    });
  }

  async regenerateIndexUnlocked(): Promise<void> {
    const graph = await this.materialize();
    await this.driver.writeIndex(renderIndex(graph));
    await this.driver.writeCards(
      graph.nodes.map((node) => ({ id: node.id, content: renderCard(node) })),
    );
  }
}

export const StorageManager = GraphStorage;

export function createGraphStorage(rootDirectory = ".ariadne"): GraphStorage {
  return new GraphStorage(rootDirectory);
}
