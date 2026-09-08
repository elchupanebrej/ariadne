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
  sequence: z.number().int().safe().min(1),
  idempotencyKey: z.string().optional(),
  payloadDigest: z.string().regex(/^[0-9a-f]{64}$/i),
  payloadLength: z.number().int().safe().nonnegative(),
  crc32: z.number().int().safe().min(0).max(0xffffffff),
  timestamp: z.string(),
  payload: z.unknown(),
});

export type JournalFailureClass =
  | "framing"
  | "checksum"
  | "sequence"
  | "record_schema"
  | "mixed_version"
  | "unsupported_version";

export interface JournalScanDiagnostic {
  code: "INCOMPLETE_TAIL";
  message: string;
  repair: string;
  detail: Record<string, unknown>;
}

export interface JournalScanResult {
  validRecords: number;
  recoveredTail: boolean;
  truncatedBytes: number;
  lastSequence: number;
  diagnostic?: JournalScanDiagnostic;
  records: FramedRecord<unknown>[];
}

export interface JournalScanOptions {
  repair?: boolean;
  repairFinalNewline?: boolean;
  workspaceRoot?: string;
  authority?: string;
  validatePayload?: (payload: unknown) => boolean;
}

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

type FrameValidation =
  | { valid: true; record: FramedRecord<unknown> }
  | {
      valid: false;
      failureClass: Exclude<JournalFailureClass, "sequence" | "record_schema">;
      reason: string;
      version?: unknown;
    };

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const inspectFrame = (frame: unknown): FrameValidation => {
  if (!isObjectRecord(frame)) {
    return { valid: false, failureClass: "framing", reason: "record is not a JSON object" };
  }

  const rec = frame;
  if (rec.schemaVersion !== 1) {
    return {
      valid: false,
      failureClass:
        typeof rec.schemaVersion === "number" && rec.schemaVersion > 1
          ? "unsupported_version"
          : "mixed_version",
      reason: "record does not use persisted format version 1",
      version: rec.schemaVersion,
    };
  }
  if (
    typeof rec.sequence !== "number" ||
    !Number.isSafeInteger(rec.sequence) ||
    rec.sequence < 1
  ) {
    return { valid: false, failureClass: "framing", reason: "sequence is not a positive safe integer" };
  }
  if (rec.idempotencyKey !== undefined && typeof rec.idempotencyKey !== "string") {
    return { valid: false, failureClass: "framing", reason: "idempotency key is not a string" };
  }
  if (typeof rec.payloadDigest !== "string" || !/^[0-9a-f]{64}$/iu.test(rec.payloadDigest)) {
    return { valid: false, failureClass: "checksum", reason: "payload digest has an invalid format" };
  }
  if (
    typeof rec.payloadLength !== "number" ||
    !Number.isSafeInteger(rec.payloadLength) ||
    rec.payloadLength < 0
  ) {
    return { valid: false, failureClass: "framing", reason: "payload length is invalid" };
  }
  if (
    typeof rec.crc32 !== "number" ||
    !Number.isSafeInteger(rec.crc32) ||
    rec.crc32 < 0 ||
    rec.crc32 > 0xffffffff
  ) {
    return { valid: false, failureClass: "checksum", reason: "CRC32 checksum is invalid" };
  }
  if (typeof rec.timestamp !== "string") {
    return { valid: false, failureClass: "framing", reason: "timestamp is not a string" };
  }
  if (!("payload" in rec)) {
    return { valid: false, failureClass: "framing", reason: "payload is missing" };
  }

  let serialized: string;
  try {
    const value = JSON.stringify(rec.payload);
    if (value === undefined) {
      return { valid: false, failureClass: "framing", reason: "payload is not JSON-serializable" };
    }
    serialized = value;
  } catch {
    return { valid: false, failureClass: "framing", reason: "payload is not JSON-serializable" };
  }

  if (Buffer.byteLength(serialized, "utf8") !== rec.payloadLength) {
    return { valid: false, failureClass: "framing", reason: "payload length does not match payload" };
  }
  if ((crc32(serialized) >>> 0) !== (rec.crc32 >>> 0)) {
    return { valid: false, failureClass: "checksum", reason: "CRC32 checksum does not match payload" };
  }
  const digest = createHash("sha256").update(serialized, "utf8").digest("hex");
  if (digest.toLowerCase() !== rec.payloadDigest.toLowerCase()) {
    return { valid: false, failureClass: "checksum", reason: "SHA-256 payload digest does not match payload" };
  }

  return { valid: true, record: rec as unknown as FramedRecord<unknown> };
};

/**
 * Verifies that a frame envelope is valid: schemaVersion is 1, sequence is a positive safe integer,
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

  const inspected = inspectFrame(target);
  return inspected.valid;
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

  const inspected = inspectFrame(parsed);
  if (!inspected.valid) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Framed record failed ${inspected.failureClass} validation.`,
      repair: "Inspect the canonical journal or restore it from a trusted backup.",
    });
  }

  return inspected.record as FramedRecord<T>;
}

export const parseFrame = parseFramedRecord;

const inferWorkspaceRoot = (filePath: string): string => {
  const parent = path.dirname(filePath);
  if (path.basename(parent) === "attempts" && path.basename(path.dirname(parent)) === ".orchestration") {
    return path.dirname(path.dirname(parent));
  }
  return parent;
};

const canonicalWorkspaceRoot = (filePath: string, workspaceRoot?: string): string =>
  canonicalizePath(workspaceRoot ?? inferWorkspaceRoot(filePath));

const relativeAuthorityPath = (workspaceRoot: string, filePath: string): string => {
  const relative = path.relative(workspaceRoot, filePath);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative)
    ? relative
    : path.basename(filePath);
};

const diagnosticDetail = (
  filePath: string,
  options: JournalScanOptions,
  line: number,
  offset: number,
  failureClass: JournalFailureClass,
  sequence?: number,
): Record<string, unknown> => {
  const workspace = canonicalWorkspaceRoot(filePath, options.workspaceRoot);
  const authority = options.authority ?? relativeAuthorityPath(workspace, filePath);
  return {
    workspace,
    authority,
    recordLocation: {
      line,
      byteOffset: offset,
      ...(sequence === undefined ? {} : { sequence }),
    },
    failureClass,
    safeNextAction:
      failureClass === "unsupported_version"
        ? "Upgrade Ariadne to a binary that supports the persisted format before retrying."
        : "Inspect the canonical authority or restore it from a trusted backup before retrying.",
  };
};

const journalFailure = (
  filePath: string,
  options: JournalScanOptions,
  line: number,
  offset: number,
  failureClass: JournalFailureClass,
  reason: string,
  sequence?: number,
  version?: unknown,
  middleRecord = false,
): AriadneError => {
  const authority = options.authority ?? path.basename(filePath);
  const code = failureClass === "unsupported_version"
    ? "UNSUPPORTED_FORMAT"
    : "CORRUPT_PERSISTED_HISTORY";
  const repair = code === "UNSUPPORTED_FORMAT"
    ? "Upgrade Ariadne to a binary that supports the persisted format before retrying."
    : "Inspect the canonical authority or restore it from a trusted backup before retrying.";
  const detail = diagnosticDetail(filePath, options, line, offset, failureClass, sequence);
  if (version !== undefined) detail.version = version;
  const context = middleRecord
    ? "Middle corruption or checksum mismatch detected in canonical history. "
    : "";
  return new AriadneError({
    code,
    message: `${context}Canonical authority '${authority}' failed ${failureClass} validation at record ${line}: ${reason}.`,
    repair,
    detail,
  });
};

const hasUnclosedJsonStructure = (line: string): boolean => {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const character of line) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{" || character === "[") {
      stack.push(character);
    } else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.at(-1) !== expected) return false;
      stack.pop();
    }
  }

  return inString || escaped || stack.length > 0;
};

const isProvablyIncompleteJsonTail = (line: string, error: unknown): boolean => {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return false;

  const message = error instanceof Error ? error.message : String(error);
  const positionMatch = /position (\d+)/iu.exec(message);
  const significantLength = line.trimEnd().length;
  const errorAtEnd =
    positionMatch !== null && Number(positionMatch[1]) >= significantLength;
  const endOfInputError = /unexpected end of json input|unterminated string/iu.test(message);

  // Node reports some incomplete objects at the parser's EOF position and others
  // as an end-of-input/unterminated-string error. Both are repairable only when
  // the bytes are still an unfinished JSON value, never merely because parsing failed.
  return (errorAtEnd || endOfInputError) && hasUnclosedJsonStructure(line);
};

/**
 * Reads a framed JSONL authority, validates its envelope and sequence, and
 * optionally validates each payload. Only an EOF parse error is truncatable:
 * a complete JSON value with bad framing, checksums, schema, or sequence is
 * persisted evidence and therefore fails closed.
 */
export async function scanFramedJournal(
  filePath: string,
  options: JournalScanOptions = {},
): Promise<JournalScanResult> {
  const repair = options.repair ?? false;
  let buffer: Buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        validRecords: 0,
        recoveredTail: false,
        truncatedBytes: 0,
        lastSequence: 0,
        records: [],
      };
    }
    throw error;
  }

  if (buffer.length === 0) {
    return {
      validRecords: 0,
      recoveredTail: false,
      truncatedBytes: 0,
      lastSequence: 0,
      records: [],
    };
  }

  let offset = 0;
  let lineNumber = 0;
  let lastValidOffset = 0;
  const records: FramedRecord<unknown>[] = [];

  while (offset < buffer.length) {
    lineNumber += 1;
    const newline = buffer.indexOf(0x0a, offset);
    const hasNewline = newline !== -1;
    const end = hasNewline ? newline : buffer.length;
    const recordEnd = hasNewline ? newline + 1 : buffer.length;
    const line = buffer.subarray(offset, end).toString("utf8").replace(/\r$/u, "");

    if (line.trim().length === 0) {
      throw journalFailure(
        filePath,
        options,
        lineNumber,
        offset,
        "framing",
        "empty record",
        undefined,
        undefined,
        records.length > 0 && recordEnd < buffer.length,
      );
    }

    let parsed: unknown;
    let parseError: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      parseError = error;
    }

    if (parseError !== undefined) {
      const isFinal = recordEnd === buffer.length;
      if (isFinal && isProvablyIncompleteJsonTail(line, parseError) && repair) {
        const truncatedBytes = buffer.length - lastValidOffset;
        await fs.promises.truncate(filePath, lastValidOffset);
        const detail = diagnosticDetail(
          filePath,
          options,
          lineNumber,
          offset,
          "framing",
        );
        detail.safeNextAction =
          "Re-apply the uncommitted operation after the incomplete tail is removed.";
        return {
          validRecords: records.length,
          recoveredTail: true,
          truncatedBytes,
          lastSequence: records.at(-1)?.sequence ?? 0,
          diagnostic: {
            code: "INCOMPLETE_TAIL",
            message: `Incomplete final frame detected and safely truncated (${truncatedBytes} bytes at offset ${lastValidOffset}).`,
            repair: "Re-apply the uncommitted operation after recovery completes.",
            detail,
          },
          records,
        };
      }
      throw journalFailure(
        filePath,
        options,
        lineNumber,
        offset,
        "framing",
        "malformed JSON record",
        undefined,
        undefined,
        records.length > 0 && recordEnd < buffer.length,
      );
    }

    const inspected = inspectFrame(parsed);
    if (!inspected.valid) {
      throw journalFailure(
        filePath,
        options,
        lineNumber,
        offset,
        inspected.failureClass,
        inspected.reason,
        isObjectRecord(parsed) && typeof parsed.sequence === "number"
          ? parsed.sequence
          : undefined,
        inspected.version,
        records.length > 0 && recordEnd < buffer.length,
      );
    }

    const expectedSequence = records.length === 0 ? 1 : records.at(-1)!.sequence + 1;
    if (inspected.record.sequence !== expectedSequence) {
      throw journalFailure(
        filePath,
        options,
        lineNumber,
        offset,
        "sequence",
        `expected sequence ${expectedSequence}, received ${inspected.record.sequence}`,
        inspected.record.sequence,
        undefined,
        records.length > 0 && recordEnd < buffer.length,
      );
    }

    if (options.validatePayload && !options.validatePayload(inspected.record.payload)) {
      throw journalFailure(
        filePath,
        options,
        lineNumber,
        offset,
        "record_schema",
        "payload does not satisfy the authority record schema",
        inspected.record.sequence,
        undefined,
        records.length > 0 && recordEnd < buffer.length,
      );
    }

    records.push(inspected.record);
    lastValidOffset = recordEnd;
    offset = recordEnd;

    if (!hasNewline && repair && options.repairFinalNewline !== false) {
      const handle = await fs.promises.open(filePath, "a");
      try {
        await handle.writeFile("\n", "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    }
  }

  return {
    validRecords: records.length,
    recoveredTail: false,
    truncatedBytes: 0,
    lastSequence: records.at(-1)?.sequence ?? 0,
    records,
  };
}

/**
 * Reads and verifies all framed records from a canonical ledger file.
 * Returns empty array if file does not exist.
 */
export async function readFramedRecords<T = unknown>(
  filePath: string,
): Promise<FramedRecord<T>[]> {
  const result = await scanFramedJournal(filePath);
  return result.records as FramedRecord<T>[];
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
  options: { repair?: boolean; repairFinalNewline?: boolean } = {},
): Promise<{ records: FramedRecord<unknown>[] }> => {
  const result = await scanFramedJournal(filePath, {
    repair: options.repair ?? true,
    repairFinalNewline: options.repairFinalNewline,
  });
  return { records: result.records };
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
  return (
    await scanCanonicalJournal(attemptPath, {
      repair: true,
      repairFinalNewline: false,
    })
  ).records as FramedRecord<T>[];
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
