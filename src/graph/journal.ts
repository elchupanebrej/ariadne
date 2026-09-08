/**
 * Framed canonical journal persistence engine and atomic write cycle for Ariadne.
 * Implements 5-phase transaction framing, FileHandle.sync() commit point,
 * CRC32 and SHA-256 digested frames, idempotency guarantees, atomic projection swap,
 * and 4-discriminant persistence outcomes.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { crc32 } from "node:zlib";
import { z } from "zod";
import { AriadneError, type DiagnosticCode } from "../core/errors.js";
import { assertContainedPath, canonicalizePath } from "../core/containment.js";
import { acquireRootLock, withRootLock, type LockOptions } from "./lock.js";
import { assertNotLegacyWorkspace } from "./legacy.js";

/**
 * Envelope for canonical journal records appended to GRAPH.jsonl, NOTICES.jsonl,
 * and orchestration attempt ledgers.
 */
export interface FramedRecord<T = unknown> {
  schemaVersion: 1;
  sequence: number; // monotonic sequence counter within file
  idempotencyKey?: string;
  payloadDigest: string; // SHA-256 hex string of serialized payload
  payloadLength: number; // byte length of serialized payload (UTF-8)
  crc32: number; // CRC32 checksum (using crc32 from "node:zlib")
  timestamp: string; // ISO 8601
  payload: T;
}

/**
 * Zod schema for runtime validation of framed journal envelopes.
 */
export const FramedRecordSchema = z.object({
  schemaVersion: z.literal(1),
  sequence: z.number().int().nonnegative(),
  idempotencyKey: z.string().optional(),
  payloadDigest: z.string().regex(/^[0-9a-f]{64}$/i),
  payloadLength: z.number().int().nonnegative(),
  crc32: z.number().int(),
  timestamp: z.string(),
  payload: z.unknown(),
});

/**
 * Four-discriminant persistence outcome union.
 * Eliminates ambiguous boolean returns and establishes clear caller-visible durability states.
 */
export type PersistenceOutcome<T = unknown> =
  | {
      outcome: "committed";
      result: T;
      sequence: number;
      record?: FramedRecord<unknown>;
    }
  | {
      outcome: "committed_with_recovery_needed";
      result: T;
      sequence: number;
      error: Error;
      record?: FramedRecord<unknown>;
    }
  | {
      outcome: "not_committed";
      code: DiagnosticCode;
      error: Error;
    }
  | {
      outcome: "commit_unknown";
      code: "COMMIT_UNKNOWN";
      error: Error;
    };

/**
 * Individual derived projection to stage and swap.
 */
export interface ProjectionItem {
  path: string;
  content: string;
}

/**
 * Options for framing a mutation record.
 */
export interface CreateFrameOptions<T = unknown> {
  payload: T;
  sequence?: number;
  idempotencyKey?: string;
  timestamp?: string;
}

/**
 * Encodes a payload into a verified FramedRecord envelope with sequence, length prefix,
 * CRC32 checksum, and SHA-256 payload digest.
 */
export function createFramedRecord<T = unknown>(
  options: CreateFrameOptions<T>,
): FramedRecord<T> {
  let serialized: string;
  try {
    const s = JSON.stringify(options.payload);
    if (s === undefined) {
      throw new AriadneError({
        code: "INVALID_INPUT",
        message: "Payload must be JSON-serializable",
        repair: "Ensure the mutation payload does not contain functions or undefined values.",
      });
    }
    serialized = s;
  } catch (err) {
    if (err instanceof AriadneError) throw err;
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Payload must be JSON-serializable: ${err instanceof Error ? err.message : String(err)}`,
      repair: "Ensure the mutation payload is serializable to JSON without circular references.",
    });
  }

  const payloadLength = Buffer.byteLength(serialized, "utf8");
  const payloadDigest = createHash("sha256").update(serialized, "utf8").digest("hex");
  const checksum = crc32(serialized);

  const frame: FramedRecord<T> = {
    schemaVersion: 1,
    sequence: options.sequence ?? 1,
    ...(options.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    payloadDigest,
    payloadLength,
    crc32: checksum,
    timestamp: options.timestamp ?? new Date().toISOString(),
    payload: options.payload,
  };

  return frame;
}

/**
 * Overloaded convenience alias for createFramedRecord.
 */
export function createFrame<T = unknown>(
  payloadOrOptions: T | CreateFrameOptions<T>,
  options?: Omit<CreateFrameOptions<T>, "payload">,
): FramedRecord<T> {
  if (
    payloadOrOptions !== null &&
    typeof payloadOrOptions === "object" &&
    "payload" in payloadOrOptions &&
    ("sequence" in payloadOrOptions || options === undefined)
  ) {
    return createFramedRecord(payloadOrOptions as CreateFrameOptions<T>);
  }

  return createFramedRecord({
    payload: payloadOrOptions as T,
    sequence: options?.sequence ?? 1,
    idempotencyKey: options?.idempotencyKey,
    timestamp: options?.timestamp,
  });
}

/**
 * Verifies that a frame envelope is valid: schemaVersion is 1, sequence is an integer >= 0,
 * and payloadLength, CRC32, and SHA-256 payloadDigest strictly match the serialized payload.
 *
 * @param frame - Candidate frame object or serialized JSON string.
 * @returns true if valid, false otherwise.
 */
export function verifyFrame<T = unknown>(frame: unknown): frame is FramedRecord<T> {
  let target = frame;
  if (typeof target === "string") {
    try {
      target = JSON.parse(target);
    } catch {
      return false;
    }
  }

  if (!target || typeof target !== "object") {
    return false;
  }

  const rec = target as Record<string, unknown>;
  if (rec.schemaVersion !== 1) {
    return false;
  }
  if (typeof rec.sequence !== "number" || !Number.isInteger(rec.sequence) || rec.sequence < 0) {
    return false;
  }
  if (rec.idempotencyKey !== undefined && typeof rec.idempotencyKey !== "string") {
    return false;
  }
  if (typeof rec.payloadDigest !== "string" || !/^[0-9a-f]{64}$/i.test(rec.payloadDigest)) {
    return false;
  }
  if (
    typeof rec.payloadLength !== "number" ||
    !Number.isInteger(rec.payloadLength) ||
    rec.payloadLength < 0
  ) {
    return false;
  }
  if (typeof rec.crc32 !== "number" || !Number.isInteger(rec.crc32)) {
    return false;
  }
  if (typeof rec.timestamp !== "string") {
    return false;
  }
  if (!("payload" in rec)) {
    return false;
  }

  let serialized: string;
  try {
    const s = JSON.stringify(rec.payload);
    if (s === undefined) return false;
    serialized = s;
  } catch {
    return false;
  }

  const actualLength = Buffer.byteLength(serialized, "utf8");
  if (actualLength !== rec.payloadLength) {
    return false;
  }

  const actualCrc = crc32(serialized);
  if ((actualCrc >>> 0) !== (rec.crc32 >>> 0)) {
    return false;
  }

  const actualDigest = createHash("sha256").update(serialized, "utf8").digest("hex");
  if (actualDigest.toLowerCase() !== rec.payloadDigest.toLowerCase()) {
    return false;
  }

  return true;
}

/**
 * Parses and validates a framed JSON line from a canonical journal.
 * Throws AriadneError(CORRUPT_PERSISTED_HISTORY) if JSON is invalid or verification fails.
 */
export function parseFramedRecord<T = unknown>(line: string): FramedRecord<T> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch (err) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Failed to parse journal line as JSON: ${err instanceof Error ? err.message : String(err)}`,
      repair: "Inspect canonical journal file for truncated or corrupt lines.",
    });
  }

  if (!verifyFrame<T>(parsed)) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: "Framed record failed verification (mismatched length, CRC32, or SHA-256 payload digest)",
      repair: "Inspect canonical journal file for corrupted frame records.",
    });
  }

  return parsed;
}

export const parseFrame = parseFramedRecord;

/**
 * Reads and verifies all framed records from a canonical ledger file.
 * Returns empty array if file does not exist.
 */
export async function readFramedRecords<T = unknown>(
  filePath: string,
): Promise<FramedRecord<T>[]> {
  let content: string;
  try {
    content = await fs.promises.readFile(filePath, "utf8");
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return [];
    }
    throw err;
  }

  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const records: FramedRecord<T>[] = [];
  for (const line of lines) {
    records.push(parseFramedRecord<T>(line));
  }
  return records;
}

/**
 * Appends a framed record to a canonical authority file with an explicit physical disk sync
 * via `FileHandle.sync()`. The completion of `sync()` establishes the irrevocable commit point.
 */
export async function appendCanonicalRecord<T = unknown>(
  filePath: string,
  frame: FramedRecord<T>,
  options?: {
    syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
  },
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const handle = await fs.promises.open(filePath, "a");
  try {
    const line = JSON.stringify(frame) + "\n";
    await handle.writeFile(line, "utf8");
    if (options?.syncFn) {
      await options.syncFn(handle);
    } else {
      await handle.sync();
    }
  } finally {
    await handle.close();
  }
}

/**
 * Appends multiple framed records in batch to a canonical authority file,
 * followed by a single FileHandle.sync() commit point.
 */
export async function appendCanonicalRecords<T = unknown>(
  filePath: string,
  frames: readonly FramedRecord<T>[],
  options?: {
    syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
  },
): Promise<void> {
  if (frames.length === 0) return;
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const handle = await fs.promises.open(filePath, "a");
  try {
    const payload = frames.map((f) => JSON.stringify(f)).join("\n") + "\n";
    await handle.writeFile(payload, "utf8");
    if (options?.syncFn) {
      await options.syncFn(handle);
    } else {
      await handle.sync();
    }
  } finally {
    await handle.close();
  }
}

/** Creates or resets an empty canonical authority with a synchronized file handle. */
export async function resetCanonicalAuthority(
  filePath: string,
  options?: { syncFn?: (handle: fs.promises.FileHandle) => Promise<void> },
): Promise<void> {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const handle = await fs.promises.open(filePath, "w");
  try {
    if (options?.syncFn) await options.syncFn(handle);
    else await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Stages a single derived projection file in a temporary sibling file (`.tmp.<file>.<pid>.<uuid>`)
 * and atomically swaps it over the live target file using `fs.rename()`.
 */
export async function stageAndSwapProjection(
  storageRoot: string,
  targetPath: string,
  content: string,
): Promise<void> {
  const canonicalTarget = assertContainedPath(storageRoot, targetPath);
  const parentDir = path.dirname(canonicalTarget);
  await fs.promises.mkdir(parentDir, { recursive: true });

  const fileName = path.basename(canonicalTarget);
  const tempPath = path.join(parentDir, `.tmp.${fileName}.${process.pid}.${randomUUID()}`);

  try {
    await fs.promises.writeFile(tempPath, content, "utf8");
    await fs.promises.rename(tempPath, canonicalTarget);
  } catch (err) {
    await fs.promises.unlink(tempPath).catch(() => {});
    throw err;
  }
}

/**
 * Stages and atomically swaps multiple derived projection files.
 */
export async function stageAndSwapProjections(
  storageRoot: string,
  projections: readonly ProjectionItem[],
): Promise<void> {
  for (const proj of projections) {
    await stageAndSwapProjection(storageRoot, proj.path, proj.content);
  }
}

/**
 * Computes and validates the contained path for an orchestration attempt ledger.
 * Stored under `.orchestration/attempts/<id>.jsonl` isolated from domain graph records.
 */
export function getAttemptLedgerPath(storageRoot: string, attemptId: string): string {
  if (!attemptId || !/^[A-Za-z0-9_-]+$/.test(attemptId)) {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Invalid orchestration attempt ID: '${attemptId}'`,
      repair: "Ensure attempt ID contains only alphanumeric characters, dashes, and underscores.",
      detail: { attemptId },
    });
  }

  const attemptPath = path.join(storageRoot, ".orchestration", "attempts", `${attemptId}.jsonl`);
  return assertContainedPath(storageRoot, attemptPath);
}

const scanCanonicalJournal = async (
  filePath: string,
  options: { repair?: boolean } = {},
): Promise<{ records: FramedRecord<unknown>[] }> => {
  const repair = options.repair ?? true;
  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { records: [] };
    throw error;
  }

  const records: FramedRecord<unknown>[] = [];
  let offset = 0;
  let lastValidOffset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    const end = newline === -1 ? buffer.length : newline;
    const recordEnd = newline === -1 ? buffer.length : newline + 1;
    const line = buffer.subarray(offset, end).toString("utf8").replace(/\r$/u, "");
    const remaining = buffer.subarray(recordEnd).toString("utf8").trim();
    const isFinal = remaining.length === 0;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      if (!isFinal || records.length === 0) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: "Middle corruption detected in canonical history",
          repair: "Inspect the canonical journal or restore from backup.",
          detail: { filePath, offset },
        });
      }
      if (!repair) return { records };
      await fs.promises.truncate(filePath, lastValidOffset);
      return { records };
    }
    const valid = verifyFrame(parsed) &&
      (records.length === 0 || parsed.sequence === records.at(-1)!.sequence + 1);
    if (!valid) {
      if (!isFinal || records.length === 0) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: records.length === 0
            ? "Canonical history contains no verified prefix before an invalid frame"
            : "Middle corruption or sequence break detected in canonical history",
          repair: "Inspect the canonical journal or restore from backup.",
          detail: { filePath, offset },
        });
      }
      await fs.promises.truncate(filePath, lastValidOffset);
      return { records };
    }
    records.push(parsed as FramedRecord<unknown>);
    lastValidOffset = recordEnd;
    if (newline === -1 && repair) {
      const handle = await fs.promises.open(filePath, "a");
      try {
        await handle.writeFile("\n", "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
    offset = recordEnd;
  }
  return { records };
};

/**
 * Parameters configuring the 5-phase transaction write cycle.
 */
export interface ExecuteWriteCycleOptions<TResult = unknown, TPayload = unknown> {
  storageRoot: string;
  authority?: "graph" | "notices" | "attempt" | string;
  filePath?: string;
  attemptId?: string;
  payload?: TPayload;
  result?: TResult;
  idempotencyKey?: string;
  preValidate?: (context: {
    existingRecords: FramedRecord<unknown>[];
  }) => void | Promise<void>;
  mutate?: (context: {
    existingRecords: FramedRecord<unknown>[];
  }) => {
    payload: TPayload;
    result?: TResult;
    projections?: ProjectionItem[];
    idempotencyKey?: string;
  } | Promise<{
    payload: TPayload;
    result?: TResult;
    projections?: ProjectionItem[];
    idempotencyKey?: string;
  }>;
  projections?:
    | ProjectionItem[]
    | ((context: {
        record: FramedRecord<TPayload>;
        existingRecords: FramedRecord<unknown>[];
        result: TResult;
      }) => ProjectionItem[] | Promise<ProjectionItem[]>);
  lockOptions?: LockOptions;
  syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
  projectionErrorSimulator?: () => void;
  frameMetadata?: Record<string, unknown> | ((payload: TPayload) => Record<string, unknown>);
  idempotentResult?: (payload: unknown) => TResult;
}

/**
 * Executes a mutation through the 5-phase atomic write cycle:
 * 1. Acquire root (or attempt) lock.
 * 2. Ingest and pre-validate existing history and idempotency key.
 * 3. Append framed record to canonical authority and call FileHandle.sync() (Commit Point).
 * 4. Stage and atomically rename derived projections.
 * 5. Release lock and return explicit 4-discriminant outcome.
 */
export async function executeWriteCycle<TResult = unknown, TPayload = unknown>(
  options: ExecuteWriteCycleOptions<TResult, TPayload>,
): Promise<PersistenceOutcome<TResult>> {
  const canonicalRoot = canonicalizePath(options.storageRoot);

  let canonicalFilePath: string;
  let defaultLockPath: string;

  if (options.filePath) {
    canonicalFilePath = assertContainedPath(canonicalRoot, options.filePath);
    defaultLockPath = path.join(canonicalRoot, ".lock");
  } else if (options.authority === "notices") {
    canonicalFilePath = path.join(canonicalRoot, "NOTICES.jsonl");
    defaultLockPath = path.join(canonicalRoot, ".lock");
  } else if (options.authority === "attempt") {
    if (!options.attemptId) {
      return {
        outcome: "not_committed",
        code: "INVALID_INPUT",
        error: new AriadneError({
          code: "INVALID_INPUT",
          message: "attemptId is required when authority is 'attempt'",
        }),
      };
    }
    try {
      canonicalFilePath = getAttemptLedgerPath(canonicalRoot, options.attemptId);
      defaultLockPath = path.join(canonicalRoot, ".lock");
    } catch (err) {
      if (err instanceof AriadneError) {
        return { outcome: "not_committed", code: err.code, error: err };
      }
      return {
        outcome: "not_committed",
        code: "INVALID_INPUT",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  } else {
    // Default authority: domain graph
    canonicalFilePath = path.join(canonicalRoot, "GRAPH.jsonl");
    defaultLockPath = path.join(canonicalRoot, ".lock");
  }

  const effectiveLockOptions: LockOptions = {
    ...options.lockOptions,
    lockPath: options.lockOptions?.lockPath ?? defaultLockPath,
  };

  try {
    return await withRootLock(
      canonicalRoot,
      async () => {
        // Phase 2: Ingest & Pre-Validate
        await assertNotLegacyWorkspace(canonicalRoot);

        let existingRecords: FramedRecord<unknown>[] = [];
        try {
          existingRecords = (await scanCanonicalJournal(canonicalFilePath)).records;
        } catch (readErr) {
          if (readErr instanceof AriadneError) {
            return {
              outcome: "not_committed",
              code: readErr.code,
              error: readErr,
            };
          }
          return {
            outcome: "not_committed",
            code: "CORRUPT_PERSISTED_HISTORY",
            error: readErr instanceof Error ? readErr : new Error(String(readErr)),
          };
        }

        let activePayload: TPayload;
        let activeResult: TResult;
        let stagedProjections: ProjectionItem[] = [];

        try {
          if (options.mutate) {
            const mut = await options.mutate({ existingRecords });
            activePayload = mut.payload;
            activeResult = (mut.result !== undefined ? mut.result : activePayload) as TResult;
            if (mut.idempotencyKey !== undefined) {
              options = { ...options, idempotencyKey: mut.idempotencyKey };
            }
            if (mut.projections) {
              stagedProjections = [...mut.projections];
            }
          } else {
            if (options.payload === undefined) {
              throw new AriadneError({
                code: "INVALID_INPUT",
                message: "Either payload or mutate function must be provided to executeWriteCycle",
              });
            }
            activePayload = options.payload;
            activeResult = (
              options.result !== undefined ? options.result : activePayload
            ) as TResult;
            if (Array.isArray(options.projections)) {
              stagedProjections = [...options.projections];
            }
          }

          if (options.preValidate) {
            await options.preValidate({ existingRecords });
          }
        } catch (preErr) {
          if (preErr instanceof AriadneError) {
            if (preErr.code === "IDEMPOTENCY_CONFLICT") {
              throw preErr;
            }
            return {
              outcome: "not_committed",
              code: preErr.code,
              error: preErr,
            };
          }
          return {
            outcome: "not_committed",
            code: "INVALID_INPUT",
            error: preErr instanceof Error ? preErr : new Error(String(preErr)),
          };
        }

        const nextSequence =
          existingRecords.length > 0
            ? existingRecords[existingRecords.length - 1].sequence + 1
            : 1;

        const idempotencyKey =
          options.idempotencyKey ??
          (typeof activePayload === "object" && activePayload !== null && "idempotencyKey" in activePayload
            ? String((activePayload as Record<string, unknown>).idempotencyKey)
            : undefined);

        let candidateFrame: FramedRecord<TPayload>;
        try {
          const frame = createFrame(activePayload, {
            sequence: nextSequence,
            idempotencyKey,
          });
          const metadata =
            typeof options.frameMetadata === "function"
              ? options.frameMetadata(activePayload)
              : options.frameMetadata;
          candidateFrame = metadata === undefined ? frame : { ...frame, ...metadata };
        } catch (frameErr) {
          if (frameErr instanceof AriadneError) {
            return { outcome: "not_committed", code: frameErr.code, error: frameErr };
          }
          return {
            outcome: "not_committed",
            code: "INVALID_INPUT",
            error: frameErr instanceof Error ? frameErr : new Error(String(frameErr)),
          };
        }

        // Idempotency Key Evaluation
        if (idempotencyKey) {
          const match = existingRecords.find((r) => r.idempotencyKey === idempotencyKey);
          if (match) {
            if (match.payloadDigest === candidateFrame.payloadDigest) {
              try {
                if (typeof options.projections === "function") {
                  stagedProjections = [
                    ...stagedProjections,
                    ...(await options.projections({
                      record: candidateFrame,
                      existingRecords,
                    result: options.idempotentResult
                      ? options.idempotentResult(match.payload)
                      : (match.payload as TResult),
                    })),
                  ];
                }
                if (stagedProjections.length > 0) {
                  await stageAndSwapProjections(canonicalRoot, stagedProjections);
                }
              } catch (projectionError) {
                return {
                  outcome: "committed_with_recovery_needed",
                  result: match.payload as TResult,
                  sequence: match.sequence,
                  record: match,
                  error: projectionError instanceof Error
                    ? projectionError
                    : new Error(String(projectionError)),
                };
              }
              return {
                outcome: "committed",
                result: options.idempotentResult
                  ? options.idempotentResult(match.payload)
                  : (match.payload as TResult),
                sequence: match.sequence,
                record: match,
              };
            }
            throw new AriadneError({
              code: "IDEMPOTENCY_CONFLICT",
              message: `Idempotency key '${idempotencyKey}' reused with different payload digest`,
              repair: undefined,
              detail: {
                idempotencyKey,
                existingDigest: match.payloadDigest,
                attemptedDigest: candidateFrame.payloadDigest,
              },
            });
          }
        }

        // Phase 3: Framed Canonical Append with FileHandle.sync()
        try {
          await appendCanonicalRecord(canonicalFilePath, candidateFrame, {
            syncFn: options.syncFn,
          });
        } catch (appendErr) {
          return {
            outcome: "commit_unknown",
            code: "COMMIT_UNKNOWN",
            error: appendErr instanceof Error ? appendErr : new Error(String(appendErr)),
          };
        }

        // Irrevocable Commit Point Reached!
        // Phase 4: Projection Staging & Atomic Replace
        try {
          if (typeof options.projections === "function") {
            const generated = await options.projections({
              record: candidateFrame,
              existingRecords,
              result: activeResult,
            });
            stagedProjections = [...stagedProjections, ...generated];
          }

          if (options.projectionErrorSimulator) {
            options.projectionErrorSimulator();
          }

          if (stagedProjections.length > 0) {
            await stageAndSwapProjections(canonicalRoot, stagedProjections);
          }
        } catch (projErr) {
          return {
            outcome: "committed_with_recovery_needed",
            result: activeResult,
            sequence: candidateFrame.sequence,
            record: candidateFrame,
            error: projErr instanceof Error ? projErr : new Error(String(projErr)),
          };
        }

        // Phase 5: Success
        return {
          outcome: "committed",
          result: activeResult,
          sequence: candidateFrame.sequence,
          record: candidateFrame,
        };
      },
      effectiveLockOptions,
    );
  } catch (outerErr: unknown) {
    if (outerErr instanceof AriadneError) {
      if (outerErr.code === "IDEMPOTENCY_CONFLICT") {
        throw outerErr;
      }
      return {
        outcome: "not_committed",
        code: outerErr.code,
        error: outerErr,
      };
    }

    return {
      outcome: "not_committed",
      code: "INVALID_INPUT",
      error: outerErr instanceof Error ? outerErr : new Error(String(outerErr)),
    };
  }
}

/**
 * Appends a pointer-only event to a dedicated orchestration attempt ledger
 * under `.orchestration/attempts/<id>.jsonl` isolated from the domain graph.
 */
export async function appendAttemptEvent<T = unknown>(
  storageRoot: string,
  attemptId: string,
  event: T,
  options?: {
    idempotencyKey?: string;
    lockOptions?: LockOptions;
    syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
  },
): Promise<PersistenceOutcome<T>> {
  return executeWriteCycle<T, T>({
    storageRoot,
    authority: "attempt",
    attemptId,
    payload: event,
    result: event,
    idempotencyKey: options?.idempotencyKey,
    lockOptions: options?.lockOptions,
    syncFn: options?.syncFn,
  });
}

/**
 * Reads all framed events from an orchestration attempt ledger.
 */
export async function readAttemptEvents<T = unknown>(
  storageRoot: string,
  attemptId: string,
): Promise<FramedRecord<T>[]> {
  const attemptPath = getAttemptLedgerPath(storageRoot, attemptId);
  return (await scanCanonicalJournal(attemptPath, { repair: false })).records as FramedRecord<T>[];
}

/**
 * Appends a record to the canonical domain graph journal (GRAPH.jsonl).
 */
export async function appendGraphRecord<TResult = unknown, TPayload = unknown>(
  storageRoot: string,
  payload: TPayload,
  options?: {
    idempotencyKey?: string;
    result?: TResult;
    projections?:
      | ProjectionItem[]
      | ((context: {
          record: FramedRecord<TPayload>;
          existingRecords: FramedRecord<unknown>[];
          result: TResult;
        }) => ProjectionItem[] | Promise<ProjectionItem[]>);
    preValidate?: (context: {
      existingRecords: FramedRecord<unknown>[];
    }) => void | Promise<void>;
    lockOptions?: LockOptions;
    syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
    projectionErrorSimulator?: () => void;
  },
): Promise<PersistenceOutcome<TResult>> {
  return executeWriteCycle<TResult, TPayload>({
    storageRoot,
    authority: "graph",
    payload,
    result: options?.result,
    idempotencyKey: options?.idempotencyKey,
    projections: options?.projections,
    preValidate: options?.preValidate,
    lockOptions: options?.lockOptions,
    syncFn: options?.syncFn,
    projectionErrorSimulator: options?.projectionErrorSimulator,
  });
}

/**
 * Appends an operational notice to the canonical operational log (NOTICES.jsonl).
 */
export async function appendNoticeRecord<T = unknown>(
  storageRoot: string,
  notice: T,
  options?: {
    idempotencyKey?: string;
    lockOptions?: LockOptions;
    syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
  },
): Promise<PersistenceOutcome<T>> {
  return executeWriteCycle<T, T>({
    storageRoot,
    authority: "notices",
    payload: notice,
    result: notice,
    idempotencyKey: options?.idempotencyKey,
    lockOptions: options?.lockOptions,
    syncFn: options?.syncFn,
  });
}

/**
 * Object-oriented persistence engine coordinating writes across canonical authorities
 * and derived projections.
 */
export class JournalWriter {
  readonly storageRoot: string;
  readonly graphPath: string;
  readonly noticesPath: string;

  constructor(storageRoot = ".ariadne") {
    this.storageRoot = canonicalizePath(storageRoot);
    this.graphPath = path.join(this.storageRoot, "GRAPH.jsonl");
    this.noticesPath = path.join(this.storageRoot, "NOTICES.jsonl");
  }

  async appendGraph<TResult = unknown, TPayload = unknown>(
    payload: TPayload,
    options?: {
      idempotencyKey?: string;
      result?: TResult;
      projections?:
        | ProjectionItem[]
        | ((context: {
            record: FramedRecord<TPayload>;
            existingRecords: FramedRecord<unknown>[];
            result: TResult;
          }) => ProjectionItem[] | Promise<ProjectionItem[]>);
      preValidate?: (context: {
        existingRecords: FramedRecord<unknown>[];
      }) => void | Promise<void>;
      lockOptions?: LockOptions;
      syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
      projectionErrorSimulator?: () => void;
    },
  ): Promise<PersistenceOutcome<TResult>> {
    return appendGraphRecord<TResult, TPayload>(this.storageRoot, payload, options);
  }

  async appendNotice<T = unknown>(
    notice: T,
    options?: {
      idempotencyKey?: string;
      lockOptions?: LockOptions;
      syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
    },
  ): Promise<PersistenceOutcome<T>> {
    return appendNoticeRecord<T>(this.storageRoot, notice, options);
  }

  async appendAttempt<T = unknown>(
    attemptId: string,
    event: T,
    options?: {
      idempotencyKey?: string;
      lockOptions?: LockOptions;
      syncFn?: (handle: fs.promises.FileHandle) => Promise<void>;
    },
  ): Promise<PersistenceOutcome<T>> {
    return appendAttemptEvent<T>(this.storageRoot, attemptId, event, options);
  }

  async readGraph<T = unknown>(): Promise<FramedRecord<T>[]> {
    return readFramedRecords<T>(this.graphPath);
  }

  async readNotices<T = unknown>(): Promise<FramedRecord<T>[]> {
    return readFramedRecords<T>(this.noticesPath);
  }

  async readAttempt<T = unknown>(attemptId: string): Promise<FramedRecord<T>[]> {
    return readAttemptEvents<T>(this.storageRoot, attemptId);
  }

  async writeCycle<TResult = unknown, TPayload = unknown>(
    options: Omit<ExecuteWriteCycleOptions<TResult, TPayload>, "storageRoot">,
  ): Promise<PersistenceOutcome<TResult>> {
    return executeWriteCycle<TResult, TPayload>({
      ...options,
      storageRoot: this.storageRoot,
    });
  }
}
