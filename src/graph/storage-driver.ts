import {
  access,
  appendFile,
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
import type { GraphEvent, MaterializedGraph } from "./storage.js";
import { createFramedRecord } from "./journal.js";
import { assertWithinCapacity } from "./capacity.js";

// Concurrency queues for same-process serialization
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

export interface StorageDriver {
  readEvents(): Promise<GraphEvent[]>;
  appendEvents(events: readonly GraphEvent[]): Promise<void>;
  readState(): Promise<Record<string, unknown> | null>;
  writeState(state: Record<string, unknown>): Promise<void>;
  writeIndex(content: string): Promise<void>;
  writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void>;
  deleteCard(id: string): Promise<void>;
  withLock<T>(operation: () => Promise<T>): Promise<T>;
  init(): Promise<void>;
}

export class FileSystemStorageDriver implements StorageDriver {
  public readonly root: string;
  public readonly graphPath: string;
  public readonly statePath: string;
  public readonly indexPath: string;
  public readonly cardsDir: string;
  public readonly lockPath: string;

  constructor(root: string) {
    this.root = root;
    this.graphPath = join(root, "GRAPH.jsonl");
    this.statePath = join(root, "STATE.yaml");
    this.indexPath = join(root, "INDEX.md");
    this.cardsDir = join(root, "cards");
    this.lockPath = join(root, ".lock");
  }

  async init(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await mkdir(this.cardsDir, { recursive: true });
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return enqueue(this.root, async () => {
      await mkdir(dirname(this.lockPath), { recursive: true });
      const startedAt = Date.now();
      while (true) {
        try {
          await mkdir(this.lockPath);
          await writeFile(join(this.lockPath, "owner"), `${process.pid}\n`, "utf8");
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          try {
            const age = Date.now() - (await stat(this.lockPath)).mtimeMs;
            if (age > LOCK_STALE_MS) await rm(this.lockPath, { recursive: true, force: true });
          } catch (statError) {
            if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
          }
          if (Date.now() - startedAt > LOCK_STALE_MS) {
            throw new Error(`Timed out waiting for storage lock: ${this.lockPath}`);
          }
          await sleep(LOCK_WAIT_MS);
        }
      }

      try {
        return await operation();
      } finally {
        await rm(this.lockPath, { recursive: true, force: true });
      }
    });
  }

  private async repairJournalTail(): Promise<void> {
    let raw: Buffer;
    try {
      raw = await readFile(this.graphPath);
    } catch {
      return;
    }
    if (raw.length === 0) return;

    let validByteLength = 0;
    let offset = 0;

    while (offset < raw.length) {
      const nextNewline = raw.indexOf(0x0a, offset);
      if (nextNewline === -1) {
        const line = raw.subarray(offset).toString("utf8").trim();
        if (line.length > 0) {
          try {
            JSON.parse(line);
            validByteLength = raw.length;
          } catch {
            // Unparseable partial line without newline -> discard
          }
        }
        break;
      }

      const line = raw.subarray(offset, nextNewline).toString("utf8").trim();
      if (line.length > 0) {
        try {
          JSON.parse(line);
          validByteLength = nextNewline + 1;
        } catch {
          break;
        }
      } else {
        validByteLength = nextNewline + 1;
      }
      offset = nextNewline + 1;
    }

    if (validByteLength < raw.length) {
      await truncate(this.graphPath, validByteLength);
    }
  }

  async readEvents(): Promise<GraphEvent[]> {
    try {
      const content = await readFile(this.graphPath, "utf8");
      const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
      const events: GraphEvent[] = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const event =
            parsed && typeof parsed === "object" && "schemaVersion" in parsed && "payload" in parsed
              ? (parsed as { payload: unknown }).payload
              : parsed;
          events.push(event as GraphEvent);
        } catch {
          // If reading fails on corrupt line, try tail repair and re-read
          await this.repairJournalTail();
          const repairedContent = await readFile(this.graphPath, "utf8");
          return repairedContent
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const parsed = JSON.parse(l);
              return (parsed && typeof parsed === "object" && "schemaVersion" in parsed && "payload" in parsed
                ? (parsed as { payload: unknown }).payload
                : parsed) as GraphEvent;
            });
        }
      }
      return events;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async appendEvents(events: readonly GraphEvent[]): Promise<void> {
    if (events.length === 0) return;
    await mkdir(this.root, { recursive: true });
    let existingCount = 0;
    try {
      const existing = await readFile(this.graphPath, "utf8");
      existingCount = existing.split("\n").filter((l) => l.trim().length > 0).length;
    } catch {
      // file does not exist yet
    }
    assertWithinCapacity({ eventCount: existingCount + events.length });
    const payload =
      events
        .map((event, idx) =>
          JSON.stringify(createFramedRecord({ payload: event, sequence: existingCount + idx + 1 })),
        )
        .join("\n") + "\n";
    await appendFile(this.graphPath, payload, "utf8");
  }

  async readState(): Promise<Record<string, unknown> | null> {
    try {
      const content = await readFile(this.statePath, "utf8");
      // JSON is valid YAML subset
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeState(state: Record<string, unknown>): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const tempPath = `${this.statePath}.${randomUUID()}.tmp`;
    const toWrite = {
      schema_version: 1,
      ...state,
    };
    await writeFile(tempPath, JSON.stringify(toWrite, null, 2) + "\n", "utf8");
    await rename(tempPath, this.statePath);
  }

  async writeIndex(content: string): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const tempPath = `${this.indexPath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, content.endsWith("\n") ? content : content + "\n", "utf8");
    await rename(tempPath, this.indexPath);
  }

  async writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void> {
    await mkdir(this.cardsDir, { recursive: true });
    for (const { id, content } of cards) {
      const cardPath = join(this.cardsDir, `${id}.md`);
      const tempPath = `${cardPath}.${randomUUID()}.tmp`;
      await writeFile(tempPath, content.endsWith("\n") ? content : content + "\n", "utf8");
      await rename(tempPath, cardPath);
    }
  }

  async deleteCard(id: string): Promise<void> {
    const cardPath = join(this.cardsDir, `${id}.md`);
    await rm(cardPath, { force: true });
  }
}

export class InMemoryStorageDriver implements StorageDriver {
  public events: GraphEvent[] = [];
  public state: Record<string, unknown> | null = null;
  public indexContent: string = "";
  public cards: Map<string, string> = new Map();
  private locked = false;

  async init(): Promise<void> {}

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    while (this.locked) {
      await sleep(2);
    }
    this.locked = true;
    try {
      return await operation();
    } finally {
      this.locked = false;
    }
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

  async writeIndex(content: string): Promise<void> {
    this.indexContent = content;
  }

  async writeCards(cards: ReadonlyArray<{ id: string; content: string }>): Promise<void> {
    for (const card of cards) {
      this.cards.set(card.id, card.content);
    }
  }

  async deleteCard(id: string): Promise<void> {
    this.cards.delete(id);
  }
}
