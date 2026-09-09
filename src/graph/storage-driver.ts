import { lstat, mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { AriadneError } from "../core/errors.js";
import type { GraphEvent } from "./storage.js";
import {
  appendCanonicalRecords,
  createFramedRecord,
  readFramedRecords,
  stageAndSwapProjection,
  type FramedRecord,
} from "./journal.js";
import { assertNotLegacyWorkspace } from "./legacy.js";
import { withRootLock } from "./lock.js";
import { scanAndRecoverJournal } from "./recovery.js";
import { assertWithinCapacity } from "./capacity.js";

// The directory lock is the cross-process seam. This queue only prevents
// callers in the same process from needlessly contending on that seam.
const pathQueues = new Map<string, Promise<unknown>>();
const MIGRATION_MARKER_FILE = "migration-marker.json";
const ACTIVE_MIGRATION_PHASES = new Set(["STAGED", "SWAPPING", "ROLLING_BACK"]);
const TERMINAL_MIGRATION_PHASES = new Set(["COMPLETE", "ROLLED_BACK"]);

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

const graphEventIdempotencyKey = (event: GraphEvent): string =>
  `graph-event:${createHash("sha256").update(JSON.stringify(event), "utf8").digest("hex")}`;

/**
 * Prevents readers and writers from observing a partially swapped authority set.
 * Migration uses the marker as a durable read barrier because portable Node.js
 * filesystems cannot rename several canonical authority files as one operation.
 */
const assertStableWorkspace = async (root: string): Promise<void> => {
  const markerPath = join(root, MIGRATION_MARKER_FILE);
  let markerContent: string;
  try {
    const markerStats = await lstat(markerPath);
    if (!markerStats.isFile()) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: "Migration marker is not a regular file.",
        repair: "Inspect or restore migration-marker.json before reading the workspace.",
        detail: { markerPath },
      });
    }
    markerContent = await readFile(markerPath, "utf8");
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    if (error instanceof AriadneError) throw error;
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Migration marker could not be read: ${error instanceof Error ? error.message : String(error)}`,
      repair: "Inspect or restore migration-marker.json before reading the workspace.",
      detail: { markerPath },
    });
  }

  let marker: unknown;
  try {
    marker = JSON.parse(markerContent) as unknown;
  } catch (error) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Migration marker is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      repair: "Inspect or restore migration-marker.json before reading the workspace.",
      detail: { markerPath },
    });
  }

  if (
    !marker ||
    typeof marker !== "object" ||
    (marker as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    typeof (marker as { phase?: unknown }).phase !== "string"
  ) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: "Migration marker has invalid metadata.",
      repair: "Inspect or restore migration-marker.json before reading the workspace.",
      detail: { markerPath },
    });
  }

  const phase = (marker as { phase: string }).phase;
  if (ACTIVE_MIGRATION_PHASES.has(phase)) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Workspace migration is in phase '${phase}'; resume or roll back migration before reading it.`,
      repair: "Run 'ariadne migrate' to resume or 'ariadne migrate --rollback <migration-id>' to restore the workspace.",
      detail: { markerPath, phase },
    });
  }

  const markerRecord = marker as { nextStep?: unknown; swapPlan?: unknown };
  if (
    !TERMINAL_MIGRATION_PHASES.has(phase) ||
    !Array.isArray(markerRecord.swapPlan) ||
    !Number.isSafeInteger(markerRecord.nextStep) ||
    markerRecord.nextStep !== markerRecord.swapPlan.length
  ) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Migration marker has an invalid terminal checkpoint for phase '${phase}'.`,
      repair: "Inspect or restore migration-marker.json before reading the workspace.",
      detail: { markerPath, phase },
    });
  }
};

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

  private async withStableRead<T>(operation: () => Promise<T>): Promise<T> {
    if (this.lockDepth > 0) {
      await assertStableWorkspace(this.root);
      return operation();
    }
    return enqueue(this.root, async () =>
      withRootLock(this.root, async () => {
        await assertStableWorkspace(this.root);
        return operation();
      }),
    );
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
    await mkdir(this.root, { recursive: true });
    await this.withLock(async () => {
      await mkdir(this.cardsDir, { recursive: true });
    });
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    return enqueue(this.root, async () =>
      withRootLock(this.root, async () => {
        await assertStableWorkspace(this.root);
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
        await assertStableWorkspace(this.root);
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
    return this.withStableRead(async () => {
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
    });
  }

  async appendEvents(events: readonly GraphEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.inMutation(async () => {
      const existing = await readFramedRecords(this.graphPath);
      const existingByKey = new Map(
        existing
          .filter((record) => record.idempotencyKey !== undefined)
          .map((record) => [record.idempotencyKey as string, record]),
      );
      const frames: FramedRecord<GraphEvent>[] = [];
      for (const event of events) {
        const idempotencyKey = graphEventIdempotencyKey(event);
        const candidate: FramedRecord<GraphEvent> = createFramedRecord({
          payload: event,
          sequence: existing.length + frames.length + 1,
          idempotencyKey,
        });
        const previous = existingByKey.get(idempotencyKey);
        if (previous) {
          if (previous.payloadDigest !== candidate.payloadDigest) {
            throw new AriadneError({
              code: "IDEMPOTENCY_CONFLICT",
              message: `Idempotency key '${idempotencyKey}' reused with different payload digest`,
              detail: {
                idempotencyKey,
                existingDigest: previous.payloadDigest,
                attemptedDigest: candidate.payloadDigest,
              },
            });
          }
          continue;
        }
        frames.push(candidate);
        existingByKey.set(idempotencyKey, candidate);
      }
      assertWithinCapacity({ eventCount: existing.length + frames.length });
      if (frames.length === 0) return;
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
    return this.withStableRead(async () => {
      try {
        const content = await readFile(this.statePath, "utf8");
        const parsed = JSON.parse(content) as unknown;
        return isObject(parsed) ? parsed : null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        return null;
      }
    });
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
