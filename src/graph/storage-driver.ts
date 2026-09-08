import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { AriadneError } from "../core/errors.js";
import type { GraphEvent } from "./storage.js";
import {
  appendCanonicalRecords,
  createFramedRecord,
  readFramedRecords,
  stageAndSwapProjection,
} from "./journal.js";
import { assertNotLegacyWorkspace } from "./legacy.js";
import { withRootLock } from "./lock.js";
import { scanAndRecoverJournal } from "./recovery.js";
import { assertWithinCapacity } from "./capacity.js";

// The directory lock is the cross-process seam. This queue only prevents
// callers in the same process from needlessly contending on that seam.
const pathQueues = new Map<string, Promise<unknown>>();

const enqueue = <T>(path: string, operation: () => Promise<T>): Promise<T> => {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pathQueues.set(path, current);

  return current.finally(() => {
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  });
};

export interface StorageDriver {
  readEvents(): Promise<GraphEvent[]>;
  appendEvents(events: readonly GraphEvent[]): Promise<void>;
  readState(): Promise<Record<string, unknown> | null>;
  writeState(state: Record<string, unknown>): Promise<void>;
  writeStateProjection(content: string): Promise<void>;
  writeIndex(content: string): Promise<void>;
  writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void>;
  deleteCard(id: string): Promise<void>;
  withLock<T>(operation: () => Promise<T>): Promise<T>;
  withProjectionLock<T>(operation: () => Promise<T>): Promise<T>;
  init(): Promise<void>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFramedLine = (value: unknown): boolean =>
  isObject(value) && "schemaVersion" in value;

const parseLegacyEvents = async (graphPath: string, content: string): Promise<GraphEvent[]> => {
  const lines = content.split("\n");
  const hasFinalNewline = content.endsWith("\n");
  if (hasFinalNewline) lines.pop();
  const lastMeaningfulIndex = lines.reduce(
    (last, line, index) => (line.trim() ? index : last),
    -1,
  );
  const events: GraphEvent[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as unknown;
      const payload =
        isObject(parsed) && "schemaVersion" in parsed && "payload" in parsed
          ? parsed.payload
          : parsed;
      events.push(payload as GraphEvent);
    } catch (error) {
      if (index !== lastMeaningfulIndex) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: `Failed to parse GRAPH.jsonl line ${index + 1}`,
          repair: "Inspect GRAPH.jsonl or restore from backup.",
          detail: { graphPath, line: index + 1 },
        });
      }

      const offset = Buffer.byteLength(lines.slice(0, index).join("\n"));
      const { truncate } = await import("node:fs/promises");
      await truncate(graphPath, offset === 0 ? 0 : offset + 1);
      return events;
    }
  }

  if (!hasFinalNewline && lastMeaningfulIndex >= 0) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(graphPath, "\n", "utf8");
  }
  return events;
};

export class FileSystemStorageDriver implements StorageDriver {
  public readonly root: string;
  public readonly graphPath: string;
  public readonly statePath: string;
  public readonly indexPath: string;
  public readonly cardsDir: string;
  public readonly lockPath: string;
  private lockDepth = 0;

  constructor(root: string) {
    this.root = root;
    this.graphPath = join(root, "GRAPH.jsonl");
    this.statePath = join(root, "STATE.yaml");
    this.indexPath = join(root, "INDEX.md");
    this.cardsDir = join(root, "cards");
    this.lockPath = join(root, ".lock");
  }

  private async recoverAuthorities(): Promise<void> {
    await scanAndRecoverJournal(this.graphPath);
    await scanAndRecoverJournal(join(this.root, "NOTICES.jsonl"));
  }

  private async inMutation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.lockDepth > 0) return operation();
    return this.withLock(operation);
  }

  private projectionFailure(targetPath: string, error: unknown): AriadneError {
    return new AriadneError({
      code: "PROJECTION_RECOVERY_NEEDED",
      message: `Canonical graph is committed but projection '${targetPath}' could not be replaced: ${error instanceof Error ? error.message : String(error)}`,
      repair: "Run 'ariadne status' or rebuild projections before relying on derived files.",
      detail: { targetPath },
    });
  }

  async init(): Promise<void> {
    await assertNotLegacyWorkspace(this.root);
    await mkdir(this.root, { recursive: true });
    await mkdir(this.cardsDir, { recursive: true });
    await this.recoverAuthorities();
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return enqueue(this.root, async () =>
      withRootLock(this.root, async () => {
        await assertNotLegacyWorkspace(this.root);
        await this.recoverAuthorities();
        this.lockDepth += 1;
        try {
          return await operation();
        } finally {
          this.lockDepth -= 1;
        }
      }),
    );
  }

  async withProjectionLock<T>(operation: () => Promise<T>): Promise<T> {
    return enqueue(this.root, async () =>
      withRootLock(this.root, async () => {
        this.lockDepth += 1;
        try {
          return await operation();
        } finally {
          this.lockDepth -= 1;
        }
      }),
    );
  }

  async readEvents(): Promise<GraphEvent[]> {
    let content: string;
    try {
      content = await readFile(this.graphPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    let parsedFirst: unknown;
    try {
      parsedFirst = JSON.parse(lines[0]) as unknown;
    } catch {
      return parseLegacyEvents(this.graphPath, content);
    }
    if (isFramedLine(parsedFirst)) {
      const scan = await scanAndRecoverJournal(this.graphPath);
      return scan.records.map((record) => record.payload as GraphEvent);
    }

    return parseLegacyEvents(this.graphPath, content);
  }

  async appendEvents(events: readonly GraphEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.inMutation(async () => {
      const existing = await readFramedRecords(this.graphPath);
      assertWithinCapacity({ eventCount: existing.length + events.length });
      const frames = events.map((event, index) =>
        createFramedRecord({
          payload: event,
          sequence: existing.length + index + 1,
        }),
      );
      try {
        await appendCanonicalRecords(this.graphPath, frames);
      } catch (error) {
        throw new AriadneError({
          code: "COMMIT_UNKNOWN",
          message: `Canonical graph append or synchronization failed: ${error instanceof Error ? error.message : String(error)}`,
          repair: "Inspect GRAPH.jsonl before retrying the mutation.",
          detail: { graphPath: this.graphPath },
        });
      }
    });
  }

  async readState(): Promise<Record<string, unknown> | null> {
    try {
      const content = await readFile(this.statePath, "utf8");
      const parsed = JSON.parse(content) as unknown;
      return isObject(parsed) ? parsed : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      return null;
    }
  }

  async writeState(state: Record<string, unknown>): Promise<void> {
    await this.inMutation(async () => {
      const toWrite = { schema_version: 1, ...state };
      try {
        await stageAndSwapProjection(
          this.root,
          this.statePath,
          `${JSON.stringify(toWrite, null, 2)}\n`,
        );
      } catch (error) {
        throw this.projectionFailure(this.statePath, error);
      }
    });
  }

  async writeStateProjection(content: string): Promise<void> {
    await this.inMutation(async () => {
      try {
        await stageAndSwapProjection(this.root, this.statePath, content);
      } catch (error) {
        throw this.projectionFailure(this.statePath, error);
      }
    });
  }

  async writeIndex(content: string): Promise<void> {
    await this.inMutation(async () => {
      try {
        await stageAndSwapProjection(
          this.root,
          this.indexPath,
          content.endsWith("\n") ? content : `${content}\n`,
        );
      } catch (error) {
        throw this.projectionFailure(this.indexPath, error);
      }
    });
  }

  async writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void> {
    await this.inMutation(async () => {
      try {
        await Promise.all(
          cards.map(({ id, content }) =>
            stageAndSwapProjection(
              this.root,
              join(this.cardsDir, `${id}.md`),
              content.endsWith("\n") ? content : `${content}\n`,
            ),
          ),
        );
      } catch (error) {
        throw this.projectionFailure(this.cardsDir, error);
      }
    });
  }

  async deleteCard(id: string): Promise<void> {
    await this.inMutation(async () => {
      await rm(join(this.cardsDir, `${id}.md`), { force: true });
    });
  }
}

export class InMemoryStorageDriver implements StorageDriver {
  public events: GraphEvent[] = [];
  public state: Record<string, unknown> | null = null;
  public indexContent = "";
  public cards: Map<string, string> = new Map();
  private locked = false;

  async init(): Promise<void> {}

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    while (this.locked) await new Promise((resolve) => setTimeout(resolve, 2));
    this.locked = true;
    try {
      return await operation();
    } finally {
      this.locked = false;
    }
  }

  async withProjectionLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.withLock(operation);
  }

  async readEvents(): Promise<GraphEvent[]> {
    return [...this.events];
  }

  async appendEvents(newEvents: readonly GraphEvent[]): Promise<void> {
    assertWithinCapacity({ eventCount: this.events.length + newEvents.length });
    this.events.push(...newEvents);
  }

  async readState(): Promise<Record<string, unknown> | null> {
    return this.state ? JSON.parse(JSON.stringify(this.state)) : null;
  }

  async writeState(state: Record<string, unknown>): Promise<void> {
    this.state = JSON.parse(JSON.stringify(state));
  }

  async writeStateProjection(content: string): Promise<void> {
    this.state = JSON.parse(content) as Record<string, unknown>;
  }

  async writeIndex(content: string): Promise<void> {
    this.indexContent = content;
  }

  async writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void> {
    for (const card of cards) this.cards.set(card.id, card.content);
  }

  async deleteCard(id: string): Promise<void> {
    this.cards.delete(id);
  }
}
