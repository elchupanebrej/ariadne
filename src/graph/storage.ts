import { join } from "node:path";
import { FileSystemStorageDriver } from "./storage-driver.js";
import {
  applyEvents,
  renderCard,
  renderIndex,
  StateSchema,
  type MaterializedGraph,
} from "./domain.js";

/**
 * File-backed storage facade retained as a private implementation module inside
 * the graph package (ADR-0017). External consumers use `EpistemicGraph`.
 */
export class GraphStorage {
  readonly rootDirectory: string;
  readonly statePath: string;
  readonly graphPath: string;
  readonly indexPath: string;
  readonly cardsDirectory: string;
  private readonly driver: FileSystemStorageDriver;

  constructor(rootDirectory = ".ariadne") {
    this.rootDirectory = rootDirectory;
    this.statePath = join(rootDirectory, "STATE.yaml");
    this.graphPath = join(rootDirectory, "GRAPH.jsonl");
    this.indexPath = join(rootDirectory, "INDEX.md");
    this.cardsDirectory = join(rootDirectory, "cards");
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

  async regenerateIndex(): Promise<void> {
    await this.driver.withProjectionLock(async () => {
      await this.regenerateIndexUnlocked();
    });
  }

  private async regenerateIndexUnlocked(): Promise<void> {
    const graph = await this.materialize();
    await this.driver.writeIndex(renderIndex(graph));
    await this.driver.writeCards(
      graph.nodes.map((node) => ({ id: node.id, content: renderCard(node) })),
    );
  }

  private async materialize(): Promise<MaterializedGraph> {
    return applyEvents({ nodes: [], edges: [] }, await this.driver.readEvents());
  }
}
