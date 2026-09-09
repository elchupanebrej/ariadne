/**
 * Persisted-Format Migration Engine for Ariadne.
 * Upgrades legacy v0 workspaces to V1 framed format under mutual exclusion with root locking.
 * Generates immutable SHA-256 digest backups in .ariadne/backups/<id>/,
 * synthesizes successor V1 files in .ariadne/staging/<id>/,
 * validates schema and entity invariants 100%, performs atomic swap,
 * and supports pre-flight dry-runs, rollback, and crash-recovery resumption.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { AriadneError } from "../core/errors.js";
import { canonicalizePath, assertContainedPath } from "../core/containment.js";
import { withRootLock } from "./lock.js";
import { isLegacyWorkspace } from "./legacy.js";
import {
  createFramedRecord,
  readFramedRecords,
  verifyFrame,
  type FramedRecord,
} from "./journal.js";
import { NodeSchema, type Node } from "../core/schemas/nodes.js";
import { EdgeSchema, type EpistemicEdge } from "../core/schemas/edges.js";
import {
  GraphEventSchema,
  StateSchema,
  applyEvents,
  renderIndex,
  renderCard,
  stateForGraph,
  type GraphEvent,
  type MaterializedGraph,
} from "./storage.js";
import {
  OperationalNoticeSchema,
  type OperationalNotice,
} from "../adapters/gsd/operational-notice.js";

/**
 * Options configuring workspace migration.
 */
export interface MigrateOptions {
  dryRun?: boolean;
  migrationId?: string;
  backup?: boolean;
}

/**
 * Metadata recorded for each source or target file in manifest.
 */
export interface MigrationFileEntry {
  sha256: string;
  sizeBytes: number;
}

/**
 * Predicted target file statistics for dry-run inspection.
 */
export interface PredictedFileStats {
  estimatedRecords: number;
  estimatedSizeBytes: number;
}

/**
 * Entity counts preserved during migration.
 */
export interface MigrationEntityCounts {
  nodes: number;
  edges: number;
  notices: number;
}

/**
 * Structure of manifest.json stored in backup snapshots and staging areas.
 */
export interface MigrationManifest {
  migrationId: string;
  createdAt: string;
  sourceFormat: "v0";
  targetFormat: "v1";
  status: "STAGED" | "COMPLETE" | "ROLLED_BACK";
  files: Record<string, MigrationFileEntry>;
  targetFiles?: Record<string, MigrationFileEntry>;
  entityCounts: MigrationEntityCounts;
}

type MigrationPhase = "STAGED" | "SWAPPING" | "ROLLING_BACK" | "COMPLETE" | "ROLLED_BACK";

interface MigrationSwapStep {
  kind: "file" | "directory";
  relativePath: string;
}

interface MigrationMarker {
  schemaVersion: 1;
  migrationId: string;
  phase: MigrationPhase;
  sourceFiles: Record<string, MigrationFileEntry>;
  targetFiles: Record<string, MigrationFileEntry>;
  entityCounts: MigrationEntityCounts;
  swapPlan: MigrationSwapStep[];
  nextStep: number;
}

/**
 * Result returned upon migration completion or dry-run inspection.
 */
export interface MigrationResult {
  dryRun: boolean;
  migrationId: string;
  sourceFormat: "v0";
  targetFormat: "v1";
  entityCounts: MigrationEntityCounts;
  sourceFiles: Record<string, MigrationFileEntry>;
  backupPath?: string;
  stagingPath?: string;
  predictedTarget?: Record<string, PredictedFileStats>;
  targetFiles?: Record<string, MigrationFileEntry>;
  alreadyMigrated?: boolean;
}

/**
 * Result returned upon rollback completion.
 */
export interface RollbackResult {
  migrationId: string;
  restoredFiles: string[];
  status: "ROLLED_BACK";
}

const MIGRATION_MARKER_FILE = "migration-marker.json";
const MIGRATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
const MIGRATION_PHASES = new Set<MigrationPhase>([
  "STAGED",
  "SWAPPING",
  "ROLLING_BACK",
  "COMPLETE",
  "ROLLED_BACK",
]);
const GENERATED_ROOT_FILES = new Set([
  "GRAPH.jsonl",
  "NOTICES.jsonl",
  "STATE.yaml",
  "INDEX.md",
  MIGRATION_MARKER_FILE,
]);

/** Computes SHA-256 hex digest of a buffer or string. */
export function computeSha256(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Computes SHA-256 digest and file size for a disk file. */
export async function computeFileDigest(filePath: string): Promise<MigrationFileEntry> {
  const content = await fs.promises.readFile(filePath);
  return {
    sha256: computeSha256(content),
    sizeBytes: content.byteLength,
  };
}

/** Generates a unique migration ID. */
export function generateMigrationId(): string {
  return `MIG-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

function pathError(
  code: "PATH_ESCAPE" | "INVALID_INPUT" | "CORRUPT_PERSISTED_HISTORY",
  message: string,
  targetPath: string,
): AriadneError {
  return new AriadneError({
    code,
    message,
    repair:
      code === "PATH_ESCAPE"
        ? "Ensure all migration paths remain within the canonical workspace and contain no symlinks."
        : "Inspect the migration artifact and restore it from a trusted source before retrying.",
    detail: { targetPath },
  });
}

function isNodeError(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === code,
  );
}

/**
 * Validates a path lexically and by lstat before any migration operation uses it.
 * A symlink is rejected even when its resolved target happens to remain contained.
 */
async function assertMigrationPath(
  canonicalRoot: string,
  candidatePath: string,
  expected: "file" | "directory",
  required = true,
): Promise<string> {
  const lexicalCandidate = path.resolve(candidatePath);
  const lexicalRelative = path.relative(canonicalRoot, lexicalCandidate);
  if (
    path.isAbsolute(lexicalRelative) ||
    lexicalRelative === ".." ||
    lexicalRelative.startsWith(`..${path.sep}`)
  ) {
    throw pathError("PATH_ESCAPE", `Migration path '${candidatePath}' escapes the canonical workspace.`, candidatePath);
  }

  const segments = lexicalRelative ? lexicalRelative.split(path.sep) : [];
  let current = canonicalRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    let stats: fs.Stats;
    try {
      stats = await fs.promises.lstat(current);
    } catch (error: unknown) {
      if (isNodeError(error, "ENOENT") || isNodeError(error, "ENOTDIR")) {
        if (!required) return lexicalCandidate;
        throw pathError("CORRUPT_PERSISTED_HISTORY", `Required migration path '${current}' is missing.`, current);
      }
      throw error;
    }

    if (stats.isSymbolicLink()) {
      throw pathError("PATH_ESCAPE", `Symlink migration path '${current}' is not allowed.`, current);
    }
    const isLast = index === segments.length - 1;
    if (!isLast && !stats.isDirectory()) {
      throw pathError("INVALID_INPUT", `Migration path component '${current}' is not a directory.`, current);
    }
    if (isLast) {
      const validType =
        (expected === "file" && stats.isFile()) ||
        (expected === "directory" && stats.isDirectory());
      if (!validType) {
        throw pathError(
          "INVALID_INPUT",
          `Migration path '${current}' is not a regular ${expected}.`,
          current,
        );
      }
    }
  }

  // This also catches a symlink in an existing ancestor introduced through a
  // caller-supplied absolute path, while lstat above rejects in-bound links.
  assertContainedPath(canonicalRoot, lexicalCandidate);
  return lexicalCandidate;
}

function validateRelativeMigrationPath(relativePath: string, label: string): string {
  if (
    typeof relativePath !== "string" ||
    relativePath.length === 0 ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    /^[A-Za-z]:/u.test(relativePath)
  ) {
    throw pathError("PATH_ESCAPE", `Invalid ${label} path '${String(relativePath)}'.`, relativePath);
  }

  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw pathError("PATH_ESCAPE", `Traversal segment in ${label} path '${relativePath}'.`, relativePath);
  }

  const topLevel = segments[0];
  if (topLevel === ".lock" || topLevel === "backups" || topLevel === "staging" || topLevel === MIGRATION_MARKER_FILE) {
    throw pathError("PATH_ESCAPE", `Reserved migration path '${relativePath}' is not a source or target file.`, relativePath);
  }

  return relativePath;
}

function fileEntryMatches(actual: MigrationFileEntry, expected: MigrationFileEntry): boolean {
  return actual.sha256.toLowerCase() === expected.sha256.toLowerCase() && actual.sizeBytes === expected.sizeBytes;
}

async function collectRegularFiles(
  root: string,
  options: {
    skipDirectories?: ReadonlySet<string>;
    skipDirectory?: (relativePath: string) => boolean;
    skipFiles?: (relativePath: string) => boolean;
  } = {},
): Promise<Record<string, MigrationFileEntry>> {
  const files: Record<string, MigrationFileEntry> = {};

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(root, entryPath).split(path.sep).join("/");
      const stats = await fs.promises.lstat(entryPath);

      if (stats.isSymbolicLink()) {
        throw pathError("PATH_ESCAPE", `Symlink found at migration path '${relativePath}'.`, entryPath);
      }
      if (stats.isDirectory()) {
        if (options.skipDirectories?.has(relativePath) || options.skipDirectory?.(relativePath)) continue;
        await walk(entryPath);
        continue;
      }
      if (!stats.isFile()) {
        throw pathError("INVALID_INPUT", `Non-regular file found at migration path '${relativePath}'.`, entryPath);
      }
      if (options.skipFiles?.(relativePath)) continue;
      files[relativePath] = await computeFileDigest(entryPath);
    }
  }

  await walk(root);
  return files;
}

/**
 * Recursively collects all regular files beneath canonicalRoot, skipping the
 * lock and migration-owned artifact directories. Symlinks and special files
 * are rejected rather than silently omitted.
 */
export async function collectSourceFiles(
  canonicalRoot: string,
  options: { skipCards?: boolean } = {},
): Promise<Record<string, MigrationFileEntry>> {
  await assertMigrationPath(canonicalRoot, canonicalRoot, "directory");
  for (const directory of [".lock", "backups", "staging"]) {
    await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, directory), "directory", false);
  }
  for (const fileName of ["GRAPH.jsonl", "NOTICES.jsonl", "STATE.yaml", "INDEX.md"]) {
    await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, fileName), "file", false);
  }
  await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, "cards"), "directory", false);
  return collectRegularFiles(canonicalRoot, {
    skipDirectories: new Set([".lock", "backups", "staging"]),
    skipDirectory: (relativePath) => {
      if (options.skipCards && (relativePath === "cards" || relativePath.startsWith("cards/"))) {
        return true;
      }
      const name = path.basename(relativePath);
      return name.startsWith(".migration-old-cards.") || name.startsWith(".migration-rollback-cards.");
    },
    skipFiles: (relativePath) => {
      const name = path.basename(relativePath);
      return (
        relativePath === MIGRATION_MARKER_FILE ||
        name.startsWith(".tmp.") ||
        name.endsWith(".tmp") ||
        name.startsWith(".migration-old-cards.") ||
        name.startsWith(".migration-rollback-cards.")
      );
    },
  });
}

/**
 * Ensures that `.ariadne/backups/` is listed in the root `.gitignore` file if `.gitignore` exists.
 */
export async function ensureBackupsInGitignore(canonicalRoot: string): Promise<void> {
  const candidates = [
    path.join(path.dirname(canonicalRoot), ".gitignore"),
    path.join(canonicalRoot, ".gitignore"),
    path.join(process.cwd(), ".gitignore"),
  ];

  const uniqueCandidates = [...new Set(candidates)];

  for (const gitignorePath of uniqueCandidates) {
    try {
      const exists = fs.existsSync(gitignorePath);
      if (!exists) continue;

      const content = await fs.promises.readFile(gitignorePath, "utf8");
      const lines = content.split("\n").map((l) => l.trim());
      const alreadyPresent = lines.some(
        (l) =>
          l === ".ariadne/backups/" ||
          l === ".ariadne/backups" ||
          l === "backups/" ||
          l === "backups",
      );

      if (!alreadyPresent) {
        const appended = content.endsWith("\n")
          ? `${content}.ariadne/backups/\n`
          : `${content}\n.ariadne/backups/\n`;
        await fs.promises.writeFile(gitignorePath, appended, "utf8");
      }
    } catch {
      // Non-fatal if gitignore cannot be updated
    }
  }
}

/**
 * Parsed record item from legacy GRAPH.jsonl.
 */
interface ParsedGraphItem {
  event: GraphEvent;
  originalTimestamp?: string;
  idempotencyKey?: string;
}

/**
 * Inspects and validates legacy GRAPH.jsonl, enforcing schema validity
 * and detecting mixed versions or newer formats.
 */
export async function parseAndValidateLegacyGraph(
  graphPath: string,
): Promise<{ items: ParsedGraphItem[]; nodes: Node[]; edges: EpistemicEdge[] }> {
  let content = "";
  try {
    content = await fs.promises.readFile(graphPath, "utf8");
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return { items: [], nodes: [], edges: [] };
    }
    throw err;
  }

  const lines = content
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter((l) => l.length > 0);

  const items: ParsedGraphItem[] = [];
  let foundV0 = false;
  let foundV1 = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Failed to parse GRAPH.jsonl line ${idx + 1} as JSON: ${err instanceof Error ? err.message : String(err)}`,
        repair: "Inspect GRAPH.jsonl for corrupted lines or restore from backup.",
        detail: { line: idx + 1 },
      });
    }

    if (!parsed || typeof parsed !== "object") {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Invalid non-object record in GRAPH.jsonl at line ${idx + 1}`,
        repair: "Inspect GRAPH.jsonl or restore from backup.",
        detail: { line: idx + 1 },
      });
    }

    const obj = parsed as Record<string, unknown>;

    if ("schemaVersion" in obj) {
      if (typeof obj.schemaVersion === "number" && obj.schemaVersion > 1) {
        throw new AriadneError({
          code: "UNSUPPORTED_FORMAT",
          message: `GRAPH.jsonl contains unsupported schemaVersion: ${obj.schemaVersion}`,
          repair: "Upgrade Ariadne binary to support newer format version.",
          detail: { line: idx + 1, schemaVersion: obj.schemaVersion },
        });
      }
      if (obj.schemaVersion === 1) {
        foundV1 = true;
      }
    } else {
      foundV0 = true;
    }

    if (foundV0 && foundV1) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Mixed-version records detected in GRAPH.jsonl at line ${idx + 1}`,
        repair: "Restore consistent versioned history from backup.",
        detail: { line: idx + 1 },
      });
    }

    // Extract payload and metadata
    let candidatePayload: unknown = parsed;
    let originalTimestamp: string | undefined = undefined;
    let idempotencyKey: string | undefined = undefined;

    if (verifyFrame(parsed)) {
      candidatePayload = (parsed as FramedRecord).payload;
      originalTimestamp = (parsed as FramedRecord).timestamp;
      idempotencyKey = (parsed as FramedRecord).idempotencyKey;
    } else {
      if (typeof obj.timestamp === "string") originalTimestamp = obj.timestamp;
      else if (typeof obj.created_at === "string") originalTimestamp = obj.created_at;

      if (typeof obj.idempotencyKey === "string") idempotencyKey = obj.idempotencyKey;
      else if (typeof obj.idempotency_key === "string") idempotencyKey = String(obj.idempotency_key);
    }

    // Validate candidatePayload against GraphEventSchema or Node/Edge schemas
    const eventParsed = GraphEventSchema.safeParse(candidatePayload);
    if (eventParsed.success) {
      const ev = eventParsed.data;
      if (ev.kind === "node") {
        if (!originalTimestamp && typeof (ev.node as Record<string, unknown>).timestamp === "string") {
          originalTimestamp = (ev.node as Record<string, unknown>).timestamp as string;
        } else if (!originalTimestamp && typeof (ev.node as Record<string, unknown>).created_at === "string") {
          originalTimestamp = (ev.node as Record<string, unknown>).created_at as string;
        }
      }
      items.push({ event: ev, originalTimestamp, idempotencyKey });
      continue;
    }

    const nodeParsed = NodeSchema.safeParse(candidatePayload);
    if (nodeParsed.success) {
      const node = nodeParsed.data;
      if (!originalTimestamp && typeof (node as Record<string, unknown>).timestamp === "string") {
        originalTimestamp = (node as Record<string, unknown>).timestamp as string;
      } else if (!originalTimestamp && typeof (node as Record<string, unknown>).created_at === "string") {
        originalTimestamp = (node as Record<string, unknown>).created_at as string;
      }
      items.push({
        event: { kind: "node", node },
        originalTimestamp,
        idempotencyKey,
      });
      continue;
    }

    const edgeParsed = EdgeSchema.safeParse(candidatePayload);
    if (edgeParsed.success) {
      items.push({
        event: { kind: "edge", edge: edgeParsed.data },
        originalTimestamp,
        idempotencyKey,
      });
      continue;
    }

    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Record at line ${idx + 1} failed schema validation in GRAPH.jsonl`,
      repair: "Inspect GRAPH.jsonl for schema violations or restore from backup.",
      detail: { line: idx + 1, error: eventParsed.error.format() },
    });
  }

  const materialized = applyEvents(
    { nodes: [], edges: [] },
    items.map((item) => item.event),
  );

  return { items, nodes: materialized.nodes, edges: materialized.edges };
}

/**
 * Inspects and validates legacy NOTICES.jsonl.
 */
export async function parseAndValidateLegacyNotices(
  noticesPath: string,
): Promise<{ notices: OperationalNotice[]; items: { notice: OperationalNotice; timestamp?: string }[] }> {
  let content = "";
  try {
    content = await fs.promises.readFile(noticesPath, "utf8");
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return { notices: [], items: [] };
    }
    throw err;
  }

  const lines = content
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter((l) => l.length > 0);

  const notices: OperationalNotice[] = [];
  const items: { notice: OperationalNotice; timestamp?: string }[] = [];
  let foundV0 = false;
  let foundV1 = false;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const line = lines[idx];
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Failed to parse NOTICES.jsonl line ${idx + 1} as JSON: ${err instanceof Error ? err.message : String(err)}`,
        repair: "Inspect NOTICES.jsonl for corrupted lines or restore from backup.",
        detail: { line: idx + 1 },
      });
    }

    if (!parsed || typeof parsed !== "object") {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Invalid non-object record in NOTICES.jsonl at line ${idx + 1}`,
        repair: "Inspect NOTICES.jsonl or restore from backup.",
        detail: { line: idx + 1 },
      });
    }

    const obj = parsed as Record<string, unknown>;
    if ("schemaVersion" in obj) {
      if (typeof obj.schemaVersion === "number" && obj.schemaVersion > 1) {
        throw new AriadneError({
          code: "UNSUPPORTED_FORMAT",
          message: `NOTICES.jsonl contains unsupported schemaVersion: ${obj.schemaVersion}`,
          repair: "Upgrade Ariadne binary to support newer format version.",
          detail: { line: idx + 1, schemaVersion: obj.schemaVersion },
        });
      }
      if (obj.schemaVersion === 1) foundV1 = true;
    } else {
      foundV0 = true;
    }

    if (foundV0 && foundV1) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Mixed-version records detected in NOTICES.jsonl at line ${idx + 1}`,
        repair: "Restore consistent versioned history from backup.",
        detail: { line: idx + 1 },
      });
    }

    let candidatePayload: unknown = parsed;
    let timestamp: string | undefined = undefined;

    if (verifyFrame(parsed)) {
      candidatePayload = (parsed as FramedRecord).payload;
      timestamp = (parsed as FramedRecord).timestamp;
    }

    const validated = OperationalNoticeSchema.safeParse(candidatePayload);
    if (!validated.success) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Record at line ${idx + 1} failed schema validation in NOTICES.jsonl`,
        repair: "Inspect NOTICES.jsonl for schema violations or restore from backup.",
        detail: { line: idx + 1, error: validated.error.format() },
      });
    }

    notices.push(validated.data);
    items.push({
      notice: validated.data,
      timestamp: timestamp ?? validated.data.created_at,
    });
  }

  return { notices, items };
}

/**
 * Inspects and validates legacy STATE.yaml.
 */
export async function parseAndValidateLegacyState(
  statePath: string,
): Promise<Record<string, unknown> | null> {
  let content = "";
  try {
    content = await fs.promises.readFile(statePath, "utf8");
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "ENOENT"
    ) {
      return null;
    }
    throw err;
  }

  if (content.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `Failed to parse STATE.yaml as JSON: ${err instanceof Error ? err.message : String(err)}`,
      repair: "Inspect STATE.yaml or restore from backup.",
    });
  }

  const validated = StateSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: `STATE.yaml failed schema validation: ${validated.error.message}`,
      repair: "Inspect STATE.yaml or restore from backup.",
      detail: { error: validated.error.format() },
    });
  }

  return validated.data as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFileTable(value: unknown, label: string): Record<string, MigrationFileEntry> {
  if (!isRecord(value)) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", `${label} is missing or invalid.`, label);
  }

  const files: Record<string, MigrationFileEntry> = {};
  for (const [relativePath, candidate] of Object.entries(value)) {
    validateRelativeMigrationPath(relativePath, label);
    if (
      !isRecord(candidate) ||
      typeof candidate.sha256 !== "string" ||
      !/^[0-9a-f]{64}$/iu.test(candidate.sha256) ||
      typeof candidate.sizeBytes !== "number" ||
      !Number.isSafeInteger(candidate.sizeBytes) ||
      candidate.sizeBytes < 0
    ) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Invalid digest entry for ${label} path '${relativePath}'.`,
        relativePath,
      );
    }
    files[relativePath] = {
      sha256: candidate.sha256,
      sizeBytes: candidate.sizeBytes,
    };
  }
  return files;
}

function parseMigrationManifest(
  value: unknown,
  expectedMigrationId: string,
  label: string,
): MigrationManifest {
  if (!isRecord(value)) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", `${label} is not an object.`, label);
  }
  if (
    value.migrationId !== expectedMigrationId ||
    typeof value.createdAt !== "string" ||
    value.sourceFormat !== "v0" ||
    value.targetFormat !== "v1" ||
    typeof value.status !== "string" ||
    !["STAGED", "COMPLETE", "ROLLED_BACK"].includes(value.status)
  ) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", `${label} has invalid migration metadata.`, label);
  }

  const counts = value.entityCounts;
  if (
    !isRecord(counts) ||
    !["nodes", "edges", "notices"].every(
      (key) => typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && counts[key] >= 0,
    )
  ) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", `${label} has invalid entity counts.`, label);
  }

  return {
    migrationId: expectedMigrationId,
    createdAt: value.createdAt,
    sourceFormat: "v0",
    targetFormat: "v1",
    status: value.status as MigrationManifest["status"],
    files: parseFileTable(value.files, `${label}.files`),
    ...(value.targetFiles === undefined
      ? {}
      : { targetFiles: parseFileTable(value.targetFiles, `${label}.targetFiles`) }),
    entityCounts: {
      nodes: counts.nodes as number,
      edges: counts.edges as number,
      notices: counts.notices as number,
    },
  };
}

function manifestCore(manifest: MigrationManifest): string {
  return JSON.stringify({
    migrationId: manifest.migrationId,
    sourceFormat: manifest.sourceFormat,
    targetFormat: manifest.targetFormat,
    files: manifest.files,
    targetFiles: manifest.targetFiles ?? null,
    entityCounts: manifest.entityCounts,
  });
}

function assertSameManifest(left: MigrationManifest, right: MigrationManifest, label: string): void {
  if (manifestCore(left) !== manifestCore(right)) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", `${label} does not match the durable migration manifest.`, label);
  }
}

async function readJsonFile(filePath: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
  } catch (error: unknown) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
      filePath,
    );
  }
}

async function collectAndValidateTree(
  canonicalRoot: string,
  root: string,
): Promise<Record<string, MigrationFileEntry>> {
  await assertMigrationPath(canonicalRoot, root, "directory");
  return collectRegularFiles(root);
}

async function validateManifestPaths(
  canonicalRoot: string,
  baseDirectory: string,
  files: Record<string, MigrationFileEntry>,
  required: boolean,
  label: string,
): Promise<void> {
  for (const relativePath of Object.keys(files)) {
    const safeRelativePath = validateRelativeMigrationPath(relativePath, label);
    await assertMigrationPath(
      canonicalRoot,
      path.join(baseDirectory, ...safeRelativePath.split("/")),
      "file",
      required,
    );
  }
}

async function validateLiveManifest(
  canonicalRoot: string,
  files: Record<string, MigrationFileEntry>,
  migrationId: string,
): Promise<void> {
  await validateManifestPaths(canonicalRoot, canonicalRoot, files, false, `migration '${migrationId}' source`);
  for (const [relativePath, expected] of Object.entries(files)) {
    const livePath = path.join(canonicalRoot, ...relativePath.split("/"));
    if (!(await assertMigrationPath(canonicalRoot, livePath, "file", false)) || !fs.existsSync(livePath)) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Source file '${relativePath}' was removed since interrupted migration '${migrationId}'`,
        repair: `Restore workspace from backup '.ariadne/backups/${migrationId}' or remove corrupted staging directory.`,
        detail: { migrationId, file: relativePath },
      });
    }
    const actual = await computeFileDigest(livePath);
    if (!fileEntryMatches(actual, expected)) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Source file '${relativePath}' was altered since interrupted migration '${migrationId}'`,
        repair: `Restore workspace from backup '.ariadne/backups/${migrationId}' or remove corrupted staging directory.`,
        detail: {
          migrationId,
          file: relativePath,
          expectedSha256: expected.sha256,
          actualSha256: actual.sha256,
        },
      });
    }
  }
}

async function validateBackupTree(
  canonicalRoot: string,
  backupDirectory: string,
  manifest: MigrationManifest,
  allowMissing: boolean,
): Promise<void> {
  await assertMigrationPath(canonicalRoot, backupDirectory, "directory");
  const backupManifestPath = path.join(backupDirectory, "manifest.json");
  await assertMigrationPath(canonicalRoot, backupManifestPath, "file");
  await validateManifestPaths(canonicalRoot, backupDirectory, manifest.files, !allowMissing, "backup");

  const backupFiles = await collectAndValidateTree(canonicalRoot, backupDirectory);
  const expectedFiles = new Set(["manifest.json", ...Object.keys(manifest.files)]);
  for (const relativePath of Object.keys(backupFiles)) {
    if (!expectedFiles.has(relativePath)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Unexpected file '${relativePath}' exists in the migration backup.`,
        path.join(backupDirectory, relativePath),
      );
    }
  }
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const actual = backupFiles[relativePath];
    if (!actual && allowMissing) continue;
    if (!actual || !fileEntryMatches(actual, expected)) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Backed-up file '${relativePath}' failed SHA-256 verification (corrupted backup).`,
        repair: "The backup directory has been tampered with or corrupted.",
        detail: {
          migrationId: manifest.migrationId,
          file: relativePath,
          expectedSha256: expected.sha256,
          actualSha256: actual?.sha256,
        },
      });
    }
  }
}

async function validateBackupSnapshot(
  canonicalRoot: string,
  backupDirectory: string,
  manifest: MigrationManifest,
  allowMissing = false,
): Promise<void> {
  await validateBackupTree(canonicalRoot, backupDirectory, manifest, allowMissing);
}

async function validateStagingSnapshot(
  canonicalRoot: string,
  stagingDirectory: string,
  manifest: MigrationManifest,
): Promise<void> {
  if (!manifest.targetFiles) return;
  await assertMigrationPath(canonicalRoot, stagingDirectory, "directory");
  await validateManifestPaths(canonicalRoot, stagingDirectory, manifest.targetFiles, true, "staging");
  const stagedFiles = await collectAndValidateTree(canonicalRoot, stagingDirectory);
  const expectedFiles = new Set(["manifest.json", ...Object.keys(manifest.targetFiles)]);
  for (const relativePath of Object.keys(stagedFiles)) {
    if (!expectedFiles.has(relativePath)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Unexpected file '${relativePath}' exists in the migration staging area.`,
        path.join(stagingDirectory, relativePath),
      );
    }
  }
  for (const [relativePath, expected] of Object.entries(manifest.targetFiles)) {
    const actual = stagedFiles[relativePath];
    if (!actual || !fileEntryMatches(actual, expected)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Staged file '${relativePath}' failed target digest verification.`,
        path.join(stagingDirectory, relativePath),
      );
    }
  }
}

async function readManifestAt(
  canonicalRoot: string,
  manifestPath: string,
  migrationId: string,
  label: string,
): Promise<MigrationManifest> {
  await assertMigrationPath(canonicalRoot, manifestPath, "file");
  return parseMigrationManifest(await readJsonFile(manifestPath, label), migrationId, label);
}

async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await fs.promises.open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    // Directory fsync is not available on every supported host. File fsync
    // still makes the marker durable there, while POSIX hosts get the full
    // rename-plus-directory durability guarantee.
    if (!isNodeError(error, "EISDIR") && !isNodeError(error, "EPERM") && !isNodeError(error, "EINVAL")) {
      throw error;
    }
  }
}

async function writeDurableText(canonicalRoot: string, targetPath: string, content: string): Promise<void> {
  const canonicalTarget = await assertMigrationPath(canonicalRoot, targetPath, "file", false);
  const parentDirectory = path.dirname(canonicalTarget);
  await assertMigrationPath(canonicalRoot, parentDirectory, "directory");
  const temporaryPath = path.join(
    parentDirectory,
    `.tmp.migration.${path.basename(canonicalTarget)}.${process.pid}.${randomUUID()}`,
  );
  await assertMigrationPath(canonicalRoot, temporaryPath, "file", false);

  try {
    const handle = await fs.promises.open(temporaryPath, "wx");
    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.promises.rename(temporaryPath, canonicalTarget);
    await syncDirectory(parentDirectory);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function writeManifest(
  canonicalRoot: string,
  manifestPath: string,
  manifest: MigrationManifest,
): Promise<void> {
  await writeDurableText(canonicalRoot, manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function migrationMarkerPath(canonicalRoot: string): string {
  return path.join(canonicalRoot, MIGRATION_MARKER_FILE);
}

function parseMigrationMarker(value: unknown): MigrationMarker {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker has an unsupported schema.", MIGRATION_MARKER_FILE);
  }
  if (
    typeof value.migrationId !== "string" ||
    !MIGRATION_ID_PATTERN.test(value.migrationId) ||
    typeof value.phase !== "string" ||
    !MIGRATION_PHASES.has(value.phase as MigrationPhase) ||
    typeof value.nextStep !== "number" ||
    !Number.isSafeInteger(value.nextStep) ||
    value.nextStep < 0 ||
    !isRecord(value.entityCounts)
  ) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker has invalid metadata.", MIGRATION_MARKER_FILE);
  }
  const counts = value.entityCounts;
  if (
    !["nodes", "edges", "notices"].every(
      (key) => typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && counts[key] >= 0,
    )
  ) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker has invalid entity counts.", MIGRATION_MARKER_FILE);
  }
  if (!Array.isArray(value.swapPlan)) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker has no valid swap plan.", MIGRATION_MARKER_FILE);
  }
  const swapPlan = value.swapPlan.map((step) => {
    if (
      !isRecord(step) ||
      (step.kind !== "file" && step.kind !== "directory") ||
      typeof step.relativePath !== "string"
    ) {
      throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker contains an invalid swap step.", MIGRATION_MARKER_FILE);
    }
    validateRelativeMigrationPath(step.relativePath, "marker swap");
    if (step.kind === "directory" && step.relativePath !== "cards") {
      throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker contains an invalid directory swap step.", step.relativePath);
    }
    if (step.kind === "file" && step.relativePath.startsWith("cards/")) {
      throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker splits the cards directory swap.", step.relativePath);
    }
    return { kind: step.kind, relativePath: step.relativePath } as MigrationSwapStep;
  });
  if (value.nextStep as number > swapPlan.length) {
    throw pathError("CORRUPT_PERSISTED_HISTORY", "Migration marker points beyond its swap plan.", MIGRATION_MARKER_FILE);
  }

  return {
    schemaVersion: 1,
    migrationId: value.migrationId,
    phase: value.phase as MigrationPhase,
    sourceFiles: parseFileTable(value.sourceFiles, "migration marker sourceFiles"),
    targetFiles: parseFileTable(value.targetFiles, "migration marker targetFiles"),
    entityCounts: {
      nodes: counts.nodes as number,
      edges: counts.edges as number,
      notices: counts.notices as number,
    },
    swapPlan,
    nextStep: value.nextStep as number,
  };
}

async function readMigrationMarker(canonicalRoot: string): Promise<MigrationMarker | null> {
  const markerPath = migrationMarkerPath(canonicalRoot);
  const existingPath = await assertMigrationPath(canonicalRoot, markerPath, "file", false);
  try {
    await fs.promises.access(existingPath);
  } catch (error: unknown) {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  }
  return parseMigrationMarker(await readJsonFile(existingPath, "migration marker"));
}

async function writeMigrationMarker(canonicalRoot: string, marker: MigrationMarker): Promise<void> {
  await writeDurableText(canonicalRoot, migrationMarkerPath(canonicalRoot), `${JSON.stringify(marker, null, 2)}\n`);
}

function buildSwapPlan(
  fileTables: ReadonlyArray<Record<string, MigrationFileEntry>>,
): MigrationSwapStep[] {
  const nonCards = new Set<string>();
  for (const fileTable of fileTables) {
    for (const relativePath of Object.keys(fileTable)) {
      if (!relativePath.startsWith("cards/")) nonCards.add(relativePath);
    }
  }
  return [
    ...[...nonCards].sort().map((relativePath) => ({ kind: "file" as const, relativePath })),
    { kind: "directory", relativePath: "cards" },
  ];
}

function buildRollbackPlan(
  sourceFiles: Record<string, MigrationFileEntry>,
  targetFiles: Record<string, MigrationFileEntry> = {},
): MigrationSwapStep[] {
  const nonCards = new Set(
    [...Object.keys(sourceFiles), ...Object.keys(targetFiles)].filter(
      (relativePath) => !relativePath.startsWith("cards/"),
    ),
  );
  for (const fileName of GENERATED_ROOT_FILES) {
    if (fileName !== MIGRATION_MARKER_FILE) nonCards.add(fileName);
  }
  return [
    ...[...nonCards].sort().map((relativePath) => ({ kind: "file" as const, relativePath })),
    { kind: "directory", relativePath: "cards" },
  ];
}

function markerFromManifest(
  manifest: MigrationManifest,
  targetFiles: Record<string, MigrationFileEntry>,
): MigrationMarker {
  return {
    schemaVersion: 1,
    migrationId: manifest.migrationId,
    phase: "STAGED",
    sourceFiles: manifest.files,
    targetFiles,
    entityCounts: manifest.entityCounts,
    swapPlan: buildSwapPlan([targetFiles]),
    nextStep: 0,
  };
}

function fileTableFingerprint(files: Record<string, MigrationFileEntry>): string {
  return JSON.stringify(
    Object.entries(files).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function fileTableIsSubset(
  subset: Record<string, MigrationFileEntry>,
  superset: Record<string, MigrationFileEntry>,
): boolean {
  return Object.entries(subset).every(
    ([relativePath, entry]) =>
      superset[relativePath] !== undefined && fileEntryMatches(superset[relativePath], entry),
  );
}

function swapPlanFingerprint(plan: MigrationSwapStep[]): string {
  return JSON.stringify(plan);
}

async function validateMarkerCheckpoint(
  canonicalRoot: string,
  marker: MigrationMarker,
): Promise<void> {
  if (
    (marker.phase === "COMPLETE" || marker.phase === "ROLLED_BACK") &&
    marker.nextStep !== marker.swapPlan.length
  ) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Migration marker phase '${marker.phase}' has an incomplete swap checkpoint.`,
      MIGRATION_MARKER_FILE,
    );
  }

  const rollingBack = marker.phase === "ROLLING_BACK" || marker.phase === "ROLLED_BACK";
  for (let index = 0; index < marker.nextStep; index += 1) {
    const step = marker.swapPlan[index];
    if (step.kind === "directory") {
      const expectedFiles = rollingBack ? marker.sourceFiles : marker.targetFiles;
      await validateDirectoryFileTable(
        canonicalRoot,
        path.join(canonicalRoot, step.relativePath),
        expectedFiles,
        `marker checkpoint ${marker.phase.toLowerCase()}`,
      );
      continue;
    }

    const expected = rollingBack ? marker.sourceFiles[step.relativePath] : marker.targetFiles[step.relativePath];
    const livePath = path.join(canonicalRoot, ...step.relativePath.split("/"));
    await assertMigrationPath(canonicalRoot, livePath, "file", false);
    if (!expected) {
      if (fs.existsSync(livePath)) {
        throw pathError(
          "CORRUPT_PERSISTED_HISTORY",
          `Migration marker checkpoint still contains removed file '${step.relativePath}'.`,
          livePath,
        );
      }
      continue;
    }
    await verifyFileDigest(livePath, expected, `Migration marker checkpoint '${step.relativePath}'`);
  }
}

function migrationOldCardsPath(canonicalRoot: string, migrationId: string): string {
  return path.join(canonicalRoot, `.migration-old-cards.${migrationId}`);
}

function migrationRollbackCardsPath(canonicalRoot: string, migrationId: string): string {
  return path.join(canonicalRoot, `.migration-rollback-cards.${migrationId}`);
}

async function validatePartialStagingSnapshot(
  canonicalRoot: string,
  stagingDirectory: string,
  manifest: MigrationManifest,
): Promise<void> {
  await assertMigrationPath(canonicalRoot, stagingDirectory, "directory");
  await assertMigrationPath(canonicalRoot, path.join(stagingDirectory, "manifest.json"), "file");

  const stagedFiles = await collectAndValidateTree(canonicalRoot, stagingDirectory);
  const expectedFiles = new Set(["manifest.json", ...Object.keys(manifest.targetFiles ?? {})]);
  for (const relativePath of Object.keys(stagedFiles)) {
    if (!expectedFiles.has(relativePath)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Unexpected file '${relativePath}' exists in the migration staging area.`,
        path.join(stagingDirectory, relativePath),
      );
    }
  }
  for (const [relativePath, expected] of Object.entries(manifest.targetFiles ?? {})) {
    const actual = stagedFiles[relativePath];
    if (actual && !fileEntryMatches(actual, expected)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Staged file '${relativePath}' failed target digest verification.`,
        path.join(stagingDirectory, relativePath),
      );
    }
  }
}

async function readMarkedMigration(
  canonicalRoot: string,
  marker: MigrationMarker,
): Promise<MigrationManifest> {
  const expectedPlan =
    marker.phase === "ROLLING_BACK" || marker.phase === "ROLLED_BACK"
      ? buildRollbackPlan(marker.sourceFiles, marker.targetFiles)
      : buildSwapPlan([marker.targetFiles]);
  if (swapPlanFingerprint(marker.swapPlan) !== swapPlanFingerprint(expectedPlan)) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      "Migration marker does not describe the complete deterministic swap plan.",
      MIGRATION_MARKER_FILE,
    );
  }

  const backupDirectory = path.join(canonicalRoot, "backups", marker.migrationId);
  const backupManifest = await readManifestAt(
    canonicalRoot,
    path.join(backupDirectory, "manifest.json"),
    marker.migrationId,
    `backup manifest for migration '${marker.migrationId}'`,
  );
  const durableTargetFiles = backupManifest.targetFiles ?? {};
  if (
    fileTableFingerprint(marker.sourceFiles) !== fileTableFingerprint(backupManifest.files) ||
    fileTableFingerprint(marker.targetFiles) !== fileTableFingerprint(durableTargetFiles) ||
    JSON.stringify(marker.entityCounts) !== JSON.stringify(backupManifest.entityCounts)
  ) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Migration marker for '${marker.migrationId}' does not match its durable manifest.`,
      MIGRATION_MARKER_FILE,
    );
  }

  await validateBackupSnapshot(canonicalRoot, backupDirectory, backupManifest);
  await validateManifestPaths(
    canonicalRoot,
    canonicalRoot,
    marker.sourceFiles,
    false,
    `migration '${marker.migrationId}' source`,
  );
  await validateManifestPaths(
    canonicalRoot,
    canonicalRoot,
    marker.targetFiles,
    false,
    `migration '${marker.migrationId}' target`,
  );
  await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, "cards"), "directory", false);

  const stagingDirectory = path.join(canonicalRoot, "staging", marker.migrationId);
  await assertMigrationPath(canonicalRoot, stagingDirectory, "directory", false);
  if (fs.existsSync(stagingDirectory)) {
    const stagingManifest = await readManifestAt(
      canonicalRoot,
      path.join(stagingDirectory, "manifest.json"),
      marker.migrationId,
      `staging manifest for migration '${marker.migrationId}'`,
    );
    assertSameManifest(stagingManifest, backupManifest, `Migration '${marker.migrationId}' staging manifest`);
    await validatePartialStagingSnapshot(canonicalRoot, stagingDirectory, backupManifest);
  }

  await validateMarkerCheckpoint(canonicalRoot, marker);

  return backupManifest;
}

async function removeMigrationMarker(canonicalRoot: string): Promise<void> {
  const markerPath = migrationMarkerPath(canonicalRoot);
  await assertMigrationPath(canonicalRoot, markerPath, "file", false);
  try {
    await fs.promises.unlink(markerPath);
    await syncDirectory(canonicalRoot);
  } catch (error: unknown) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

async function readInterruptedManifest(
  canonicalRoot: string,
  preferredMigrationId?: string,
): Promise<MigrationManifest | null> {
  const stagingRoot = path.join(canonicalRoot, "staging");
  const existingStagingRoot = await assertMigrationPath(canonicalRoot, stagingRoot, "directory", false);
  try {
    await fs.promises.access(existingStagingRoot);
  } catch (error: unknown) {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  }

  const entries = await fs.promises.readdir(existingStagingRoot, { withFileTypes: true });
  const subdirs: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(existingStagingRoot, entry.name);
    const stats = await fs.promises.lstat(entryPath);
    if (stats.isSymbolicLink()) {
      throw pathError("PATH_ESCAPE", `Symlink found in staging at '${entry.name}'.`, entryPath);
    }
    if (!stats.isDirectory()) {
      throw pathError("INVALID_INPUT", `Non-directory staging entry '${entry.name}' is not allowed.`, entryPath);
    }
    if (!MIGRATION_ID_PATTERN.test(entry.name)) {
      throw pathError("INVALID_INPUT", `Invalid migration directory '${entry.name}'.`, entryPath);
    }
    subdirs.push(entry.name);
  }
  if (subdirs.length === 0) return null;
  subdirs.sort();
  const candidateId = preferredMigrationId ?? subdirs.at(-1)!;
  if (!subdirs.includes(candidateId)) return null;

  const stagingDirectory = path.join(existingStagingRoot, candidateId);
  const stagingManifestPath = path.join(stagingDirectory, "manifest.json");
  const stagingManifest = await readManifestAt(
    canonicalRoot,
    stagingManifestPath,
    candidateId,
    `staging manifest for migration '${candidateId}'`,
  );
  await validateLiveManifest(canonicalRoot, stagingManifest.files, candidateId);

  const backupDirectory = path.join(canonicalRoot, "backups", candidateId);
  const backupManifestPath = path.join(backupDirectory, "manifest.json");
  try {
    await assertMigrationPath(canonicalRoot, backupDirectory, "directory");
    const backupManifest = await readManifestAt(
      canonicalRoot,
      backupManifestPath,
      candidateId,
      `backup manifest for migration '${candidateId}'`,
    );
    assertSameManifest(stagingManifest, backupManifest, `Migration '${candidateId}' staging manifest`);
    await validateBackupSnapshot(canonicalRoot, backupDirectory, backupManifest, true);
  } catch (error: unknown) {
    if (!isNodeError(error, "ENOENT") && !(error instanceof AriadneError && error.code === "MISSING_DATA")) {
      throw error;
    }
  }

  await validateStagingSnapshot(canonicalRoot, stagingDirectory, stagingManifest);
  return stagingManifest;
}

async function verifyFileDigest(
  filePath: string,
  expected: MigrationFileEntry,
  label: string,
): Promise<void> {
  const actual = await computeFileDigest(filePath);
  if (!fileEntryMatches(actual, expected)) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `${label} failed SHA-256 verification.`,
      filePath,
    );
  }
}

async function validateLiveTargetSnapshot(
  canonicalRoot: string,
  targetFiles: Record<string, MigrationFileEntry>,
): Promise<void> {
  await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, "cards"), "directory");
  for (const [relativePath, expected] of Object.entries(targetFiles)) {
    const targetPath = path.join(canonicalRoot, ...relativePath.split("/"));
    await assertMigrationPath(canonicalRoot, targetPath, "file");
    await verifyFileDigest(targetPath, expected, `Live target '${relativePath}'`);
  }
}

async function assertLiveSourceState(
  canonicalRoot: string,
  relativePath: string,
  expected: MigrationFileEntry | undefined,
  migrationId: string,
): Promise<boolean> {
  const livePath = path.join(canonicalRoot, ...relativePath.split("/"));
  await assertMigrationPath(canonicalRoot, livePath, "file", false);
  if (!fs.existsSync(livePath)) {
    if (expected) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Source file '${relativePath}' is missing during migration '${migrationId}'.`,
        livePath,
      );
    }
    return false;
  }
  if (!expected) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Unexpected live file '${relativePath}' appeared during migration '${migrationId}'.`,
      livePath,
    );
  }
  await verifyFileDigest(livePath, expected, `Live source '${relativePath}'`);
  return true;
}

async function swapMigrationFile(
  canonicalRoot: string,
  stagingDirectory: string,
  marker: MigrationMarker,
  relativePath: string,
): Promise<void> {
  const target = marker.targetFiles[relativePath];
  if (!target) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Migration swap step '${relativePath}' has no target digest.`,
      relativePath,
    );
  }

  const stagingPath = path.join(stagingDirectory, ...relativePath.split("/"));
  const livePath = path.join(canonicalRoot, ...relativePath.split("/"));
  await assertMigrationPath(canonicalRoot, stagingPath, "file", false);
  await assertMigrationPath(canonicalRoot, livePath, "file", false);

  if (fs.existsSync(stagingPath)) {
    await verifyFileDigest(stagingPath, target, `Staged file '${relativePath}'`);
    if (fs.existsSync(livePath)) {
      const source = marker.sourceFiles[relativePath];
      if (!source) {
        throw pathError(
          "CORRUPT_PERSISTED_HISTORY",
          `Live file '${relativePath}' conflicts with the migration swap.`,
          livePath,
        );
      }
      await verifyFileDigest(livePath, source, `Live source '${relativePath}'`);
    }
    await fs.promises.rename(stagingPath, livePath);
    await syncDirectory(path.dirname(livePath));
    return;
  }

  if (!fs.existsSync(livePath)) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Neither staged nor live target file '${relativePath}' is available for migration '${marker.migrationId}'.`,
      livePath,
    );
  }
  await verifyFileDigest(livePath, target, `Live target '${relativePath}'`);
}

async function validateDirectoryFileTable(
  canonicalRoot: string,
  directory: string,
  expectedFiles: Record<string, MigrationFileEntry>,
  label: string,
): Promise<void> {
  await assertMigrationPath(canonicalRoot, directory, "directory");
  const actualFiles = await collectRegularFiles(directory);
  const expectedEntries = Object.entries(expectedFiles).filter(([relativePath]) => relativePath.startsWith("cards/"));
  const expected = new Map(expectedEntries.map(([relativePath, entry]) => [relativePath.slice("cards/".length), entry]));
  for (const relativePath of Object.keys(actualFiles)) {
    if (!expected.has(relativePath)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Unexpected card '${relativePath}' exists in ${label}.`,
        path.join(directory, relativePath),
      );
    }
  }
  for (const [relativePath, expectedEntry] of expected) {
    const actual = actualFiles[relativePath];
    if (!actual || !fileEntryMatches(actual, expectedEntry)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Card '${relativePath}' failed target digest verification in ${label}.`,
        path.join(directory, relativePath),
      );
    }
  }
}

async function directoryMatchesFileTable(
  canonicalRoot: string,
  directory: string,
  expectedFiles: Record<string, MigrationFileEntry>,
): Promise<boolean> {
  await assertMigrationPath(canonicalRoot, directory, "directory");
  const actualFiles = await collectRegularFiles(directory);
  const expectedEntries = Object.entries(expectedFiles).filter(([relativePath]) => relativePath.startsWith("cards/"));
  const expected = new Map(
    expectedEntries.map(([relativePath, entry]) => [relativePath.slice("cards/".length), entry]),
  );

  if (Object.keys(actualFiles).length !== expected.size) return false;
  return Object.entries(actualFiles).every(
    ([relativePath, actual]) => {
      const expectedEntry = expected.get(relativePath);
      return expectedEntry !== undefined && fileEntryMatches(actual, expectedEntry);
    },
  );
}

async function swapMigrationCards(
  canonicalRoot: string,
  stagingDirectory: string,
  marker: MigrationMarker,
): Promise<void> {
  const stagingCards = path.join(stagingDirectory, "cards");
  const liveCards = path.join(canonicalRoot, "cards");
  const oldCards = migrationOldCardsPath(canonicalRoot, marker.migrationId);

  await assertMigrationPath(canonicalRoot, stagingCards, "directory", false);
  await assertMigrationPath(canonicalRoot, liveCards, "directory", false);
  await assertMigrationPath(canonicalRoot, oldCards, "directory", false);

  const stagingExists = fs.existsSync(stagingCards);
  const liveExists = fs.existsSync(liveCards);
  const oldExists = fs.existsSync(oldCards);

  if (oldExists && stagingExists && liveExists) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      "Migration card swap has conflicting live, staged, and old directories.",
      liveCards,
    );
  }

  if (oldExists && !stagingExists && liveExists) {
    await validateDirectoryFileTable(canonicalRoot, liveCards, marker.targetFiles, "live cards");
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }

  if (oldExists && !liveExists && stagingExists) {
    await validateDirectoryFileTable(canonicalRoot, stagingCards, marker.targetFiles, "staged cards");
    await fs.promises.rename(stagingCards, liveCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }

  if (stagingExists && liveExists) {
    await validateDirectoryFileTable(canonicalRoot, stagingCards, marker.targetFiles, "staged cards");
    await fs.promises.rename(liveCards, oldCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rename(stagingCards, liveCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }

  if (stagingExists && !liveExists && !oldExists) {
    await validateDirectoryFileTable(canonicalRoot, stagingCards, marker.targetFiles, "staged cards");
    await fs.promises.rename(stagingCards, liveCards);
    await syncDirectory(canonicalRoot);
    return;
  }

  if (!stagingExists && liveExists && !oldExists) {
    await validateDirectoryFileTable(canonicalRoot, liveCards, marker.targetFiles, "live cards");
    return;
  }

  throw pathError(
    "CORRUPT_PERSISTED_HISTORY",
    "Migration card swap has no recoverable staged or live directory.",
    liveCards,
  );
}

async function executeMigrationSwap(
  canonicalRoot: string,
  stagingDirectory: string,
  marker: MigrationMarker,
): Promise<void> {
  if (marker.phase === "COMPLETE") {
    await validateLiveTargetSnapshot(canonicalRoot, marker.targetFiles);
  } else {
    marker.phase = "SWAPPING";
    await writeMigrationMarker(canonicalRoot, marker);
    while (marker.nextStep < marker.swapPlan.length) {
      const step = marker.swapPlan[marker.nextStep];
      if (step.kind === "file") {
        await swapMigrationFile(canonicalRoot, stagingDirectory, marker, step.relativePath);
      } else {
        await swapMigrationCards(canonicalRoot, stagingDirectory, marker);
      }
      marker.nextStep += 1;
      await writeMigrationMarker(canonicalRoot, marker);
    }
    marker.phase = "COMPLETE";
    await writeMigrationMarker(canonicalRoot, marker);
    await validateLiveTargetSnapshot(canonicalRoot, marker.targetFiles);
  }

  const postCheckLegacy = await isLegacyWorkspace(canonicalRoot);
  if (postCheckLegacy) {
    throw new AriadneError({
      code: "CORRUPT_PERSISTED_HISTORY",
      message: "Post-migration check failed: workspace is still detected as legacy v0.",
      repair: "Inspect .ariadne/GRAPH.jsonl and STATE.yaml or restore from backup.",
    });
  }

  await assertMigrationPath(canonicalRoot, stagingDirectory, "directory", false);
  if (fs.existsSync(stagingDirectory)) {
    await fs.promises.rm(stagingDirectory, { recursive: true, force: true });
  }
  const oldCards = migrationOldCardsPath(canonicalRoot, marker.migrationId);
  await assertMigrationPath(canonicalRoot, oldCards, "directory", false);
  if (fs.existsSync(oldCards)) {
    await fs.promises.rm(oldCards, { recursive: true, force: true });
  }
  await syncDirectory(canonicalRoot);
  await removeMigrationMarker(canonicalRoot);
}

async function prepareRollbackCards(
  canonicalRoot: string,
  backupDirectory: string,
  manifest: MigrationManifest,
): Promise<string> {
  const rollbackCards = migrationRollbackCardsPath(canonicalRoot, manifest.migrationId);
  await assertMigrationPath(canonicalRoot, rollbackCards, "directory", false);
  if (!fs.existsSync(rollbackCards)) {
    await fs.promises.mkdir(rollbackCards, { recursive: true });
  }

  const stagedFiles = await collectRegularFiles(rollbackCards);
  const expectedFiles = new Map(
    Object.entries(manifest.files)
      .filter(([relativePath]) => relativePath.startsWith("cards/"))
      .map(([relativePath, fileInfo]) => [relativePath.slice("cards/".length), fileInfo]),
  );

  for (const relativePath of Object.keys(stagedFiles)) {
    if (!expectedFiles.has(relativePath)) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Unexpected rollback card '${relativePath}' exists in the rollback staging area.`,
        path.join(rollbackCards, relativePath),
      );
    }
  }

  for (const [relativePath, fileInfo] of expectedFiles) {
    const stagedPath = path.join(rollbackCards, relativePath);
    const existing = stagedFiles[relativePath];
    if (existing) {
      if (!fileEntryMatches(existing, fileInfo)) {
        throw pathError(
          "CORRUPT_PERSISTED_HISTORY",
          `Rollback card '${relativePath}' failed digest verification.`,
          stagedPath,
        );
      }
      continue;
    }

    const backupPath = path.join(backupDirectory, "cards", relativePath);
    await assertMigrationPath(canonicalRoot, stagedPath, "file", false);
    await fs.promises.mkdir(path.dirname(stagedPath), { recursive: true });
    await fs.promises.copyFile(backupPath, stagedPath);
    await verifyFileDigest(stagedPath, fileInfo, `Rollback card '${relativePath}'`);
  }
  await validateDirectoryFileTable(canonicalRoot, rollbackCards, manifest.files, "rollback cards");
  return rollbackCards;
}

async function validateRollbackLiveState(
  canonicalRoot: string,
  manifest: MigrationManifest,
  targetFiles: Record<string, MigrationFileEntry> = manifest.targetFiles ?? {},
): Promise<void> {
  await assertMigrationPath(canonicalRoot, canonicalRoot, "directory");
  // Validate the complete live tree before any rollback marker or replacement
  // is written. This rejects symlinks and special files in both planned and
  // unplanned live paths instead of allowing cleanup to follow attacker-owned
  // filesystem state.
  await collectSourceFiles(canonicalRoot);
  for (const step of buildRollbackPlan(manifest.files, targetFiles)) {
    if (step.kind !== "file") continue;
    const livePath = path.join(canonicalRoot, ...step.relativePath.split("/"));
    await assertMigrationPath(canonicalRoot, livePath, "file", false);
  }
  await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, "cards"), "directory", false);
  await assertMigrationPath(
    canonicalRoot,
    migrationOldCardsPath(canonicalRoot, manifest.migrationId),
    "directory",
    false,
  );
  await assertMigrationPath(
    canonicalRoot,
    migrationRollbackCardsPath(canonicalRoot, manifest.migrationId),
    "directory",
    false,
  );
  await assertMigrationPath(
    canonicalRoot,
    path.join(canonicalRoot, "staging", manifest.migrationId),
    "directory",
    false,
  );

  const oldCards = migrationOldCardsPath(canonicalRoot, manifest.migrationId);
  if (fs.existsSync(oldCards)) {
    await validateDirectoryFileTable(canonicalRoot, oldCards, manifest.files, "old migration cards");
  }

  const stagingDirectory = path.join(canonicalRoot, "staging", manifest.migrationId);
  if (fs.existsSync(stagingDirectory)) {
    await collectAndValidateTree(canonicalRoot, stagingDirectory);
  }
}

async function validateLiveSourceSnapshot(
  canonicalRoot: string,
  manifest: MigrationManifest,
): Promise<void> {
  for (const [relativePath, expected] of Object.entries(manifest.files)) {
    const livePath = path.join(canonicalRoot, ...relativePath.split("/"));
    await assertMigrationPath(canonicalRoot, livePath, "file");
    await verifyFileDigest(livePath, expected, `Restored live file '${relativePath}'`);
  }
  await assertMigrationPath(canonicalRoot, path.join(canonicalRoot, "cards"), "directory");
  await validateDirectoryFileTable(canonicalRoot, path.join(canonicalRoot, "cards"), manifest.files, "restored cards");
}

async function restoreRollbackFile(
  canonicalRoot: string,
  backupDirectory: string,
  manifest: MigrationManifest,
  relativePath: string,
): Promise<void> {
  const livePath = path.join(canonicalRoot, ...relativePath.split("/"));
  const source = manifest.files[relativePath];
  await assertMigrationPath(canonicalRoot, livePath, "file", false);

  if (!source) {
    if (fs.existsSync(livePath)) {
      await fs.promises.unlink(livePath);
      await syncDirectory(path.dirname(livePath));
    }
    return;
  }

  const backupPath = path.join(backupDirectory, ...relativePath.split("/"));
  const parentDirectory = path.dirname(livePath);
  await assertMigrationPath(canonicalRoot, parentDirectory, "directory", false);
  if (!fs.existsSync(parentDirectory)) {
    await fs.promises.mkdir(parentDirectory, { recursive: true });
  }
  const temporaryPath = path.join(
    parentDirectory,
    `.tmp.restore.${path.basename(livePath)}.${process.pid}.${randomUUID().slice(0, 8)}`,
  );
  await assertMigrationPath(canonicalRoot, temporaryPath, "file", false);
  try {
    await fs.promises.copyFile(backupPath, temporaryPath);
    await verifyFileDigest(temporaryPath, source, `Rollback file '${relativePath}'`);
    await fs.promises.rename(temporaryPath, livePath);
    await syncDirectory(parentDirectory);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => {});
    throw error;
  }
}

async function restoreRollbackCards(
  canonicalRoot: string,
  manifest: MigrationManifest,
  targetFiles: Record<string, MigrationFileEntry>,
  rollbackCards: string,
): Promise<void> {
  const liveCards = path.join(canonicalRoot, "cards");
  const oldCards = migrationOldCardsPath(canonicalRoot, manifest.migrationId);
  await assertMigrationPath(canonicalRoot, liveCards, "directory", false);
  await assertMigrationPath(canonicalRoot, oldCards, "directory", false);
  const rollbackExists = fs.existsSync(rollbackCards);
  const liveExists = fs.existsSync(liveCards);
  const oldExists = fs.existsSync(oldCards);

  const liveMatchesSource = liveExists
    ? await directoryMatchesFileTable(canonicalRoot, liveCards, manifest.files)
    : false;
  const liveHasKnownTarget = Object.keys(targetFiles).some((relativePath) => relativePath.startsWith("cards/"));

  const validateLiveTargetCards = async (): Promise<void> => {
    if (liveHasKnownTarget) {
      await validateDirectoryFileTable(canonicalRoot, liveCards, targetFiles, "live target cards");
    } else {
      await assertMigrationPath(canonicalRoot, liveCards, "directory");
      await collectRegularFiles(liveCards);
    }
  };

  if (oldExists) {
    await validateDirectoryFileTable(canonicalRoot, oldCards, manifest.files, "old migration cards");
  }

  if (oldExists && rollbackExists && liveExists) {
    if (liveMatchesSource) {
      await fs.promises.rm(rollbackCards, { recursive: true, force: true });
      await syncDirectory(canonicalRoot);
      await fs.promises.rm(oldCards, { recursive: true, force: true });
      await syncDirectory(canonicalRoot);
      return;
    }
    await validateLiveTargetCards();
    await fs.promises.rm(liveCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    await fs.promises.rename(rollbackCards, liveCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }
  if (oldExists && !rollbackExists && liveExists) {
    if (!liveMatchesSource) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        "Rollback card swap lost its staged source directory before completion.",
        liveCards,
      );
    }
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }
  if (oldExists && !liveExists && rollbackExists) {
    await validateDirectoryFileTable(canonicalRoot, rollbackCards, manifest.files, "rollback cards");
    await fs.promises.rename(rollbackCards, liveCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }
  if (rollbackExists && liveExists) {
    if (liveMatchesSource) {
      await fs.promises.rm(rollbackCards, { recursive: true, force: true });
      await syncDirectory(canonicalRoot);
      return;
    }
    await validateLiveTargetCards();
    await fs.promises.rename(liveCards, oldCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rename(rollbackCards, liveCards);
    await syncDirectory(canonicalRoot);
    await fs.promises.rm(oldCards, { recursive: true, force: true });
    await syncDirectory(canonicalRoot);
    return;
  }
  if (rollbackExists && !liveExists && !oldExists) {
    await fs.promises.rename(rollbackCards, liveCards);
    await syncDirectory(canonicalRoot);
    return;
  }
  if (!rollbackExists && liveExists && !oldExists) {
    if (!liveMatchesSource) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        "Rollback card swap has no verified source directory.",
        liveCards,
      );
    }
    return;
  }
  throw pathError(
    "CORRUPT_PERSISTED_HISTORY",
    "Rollback card swap has no recoverable directory.",
    liveCards,
  );
}

async function executeRollback(
  canonicalRoot: string,
  backupDirectory: string,
  manifest: MigrationManifest,
  marker: MigrationMarker,
): Promise<string[]> {
  if (marker.phase !== "ROLLING_BACK" && marker.phase !== "ROLLED_BACK") {
    marker.phase = "ROLLING_BACK";
    marker.swapPlan = buildRollbackPlan(marker.sourceFiles, marker.targetFiles);
    marker.nextStep = 0;
    await writeMigrationMarker(canonicalRoot, marker);
  }

  // The marker is durable before rollback staging starts. A crash while the
  // card snapshot is being prepared therefore resumes through the same
  // checkpoint rather than falling back to an untracked live mutation.
  const rollbackCards = await prepareRollbackCards(canonicalRoot, backupDirectory, manifest);

  if (marker.phase === "ROLLED_BACK") {
    await validateLiveSourceSnapshot(canonicalRoot, manifest);
  } else {
    while (marker.nextStep < marker.swapPlan.length) {
      const step = marker.swapPlan[marker.nextStep];
      if (step.kind === "file") {
        await restoreRollbackFile(canonicalRoot, backupDirectory, manifest, step.relativePath);
      } else {
        await restoreRollbackCards(canonicalRoot, manifest, marker.targetFiles, rollbackCards);
      }
      marker.nextStep += 1;
      await writeMigrationMarker(canonicalRoot, marker);
    }
    marker.phase = "ROLLED_BACK";
    await writeMigrationMarker(canonicalRoot, marker);
    await validateLiveSourceSnapshot(canonicalRoot, manifest);
  }

  manifest.status = "ROLLED_BACK";
  await writeManifest(canonicalRoot, path.join(backupDirectory, "manifest.json"), manifest);

  const stagingDirectory = path.join(canonicalRoot, "staging", manifest.migrationId);
  await assertMigrationPath(canonicalRoot, stagingDirectory, "directory", false);
  if (fs.existsSync(stagingDirectory)) {
    await fs.promises.rm(stagingDirectory, { recursive: true, force: true });
  }
  const oldCards = migrationOldCardsPath(canonicalRoot, manifest.migrationId);
  await assertMigrationPath(canonicalRoot, oldCards, "directory", false);
  if (fs.existsSync(oldCards)) {
    await fs.promises.rm(oldCards, { recursive: true, force: true });
  }
  await assertMigrationPath(canonicalRoot, rollbackCards, "directory", false);
  if (fs.existsSync(rollbackCards)) {
    await fs.promises.rm(rollbackCards, { recursive: true, force: true });
  }
  await syncDirectory(canonicalRoot);
  await removeMigrationMarker(canonicalRoot);

  return Object.keys(manifest.files);
}

/**
 * Migrates a legacy .ariadne workspace to V1 framed persistence format.
 *
 * Runs under mutual exclusion with root locking (except dryRun which is read-only).
 * Generates immutable backup in .ariadne/backups/<id>/,
 * stages successor files in .ariadne/staging/<id>/,
 * verifies 100% entity and invariant preservation,
 * and atomically swaps files to live root.
 */
export async function migrateWorkspace(
  storageRoot: string,
  options: MigrateOptions = {},
): Promise<MigrationResult> {
  const canonicalRoot = canonicalizePath(storageRoot);

  if (options.migrationId !== undefined && !/^[A-Za-z0-9_-]+$/.test(options.migrationId)) {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Invalid migrationId: '${options.migrationId}'. Must contain only alphanumeric characters, dashes, and underscores.`,
      repair: "Provide a valid migration ID without special characters.",
    });
  }

  // Validate the root before inspecting persisted migration state. Full source
  // hashing is deferred until we know this is a legacy migration; a clean V1
  // workspace must not hash every derived card merely to report "up to date".
  await assertMigrationPath(canonicalRoot, canonicalRoot, "directory");

  const marker = await readMigrationMarker(canonicalRoot);
  if (marker && options.migrationId !== undefined && marker.migrationId !== options.migrationId) {
    throw pathError(
      "CORRUPT_PERSISTED_HISTORY",
      `Durable migration marker belongs to '${marker.migrationId}', not '${options.migrationId}'.`,
      MIGRATION_MARKER_FILE,
    );
  }

  // A marker is authoritative for a partially swapped workspace. The legacy
  // staging-only fallback remains for migrations created before markers existed.
  const markedManifest = marker ? await readMarkedMigration(canonicalRoot, marker) : null;
  const interruptedManifest = marker
    ? null
    : await readInterruptedManifest(canonicalRoot, options.migrationId);

  // Check legacy status
  const legacy = await isLegacyWorkspace(canonicalRoot);
  if (!legacy && !interruptedManifest && !marker) {
    const files = await collectSourceFiles(canonicalRoot, { skipCards: true });
    const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
    const noticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
    const { nodes, edges } = await parseAndValidateLegacyGraph(graphPath);
    const { notices } = await parseAndValidateLegacyNotices(noticesPath);

    return {
      dryRun: options.dryRun ?? false,
      migrationId: options.migrationId ?? "UP-TO-DATE",
      sourceFormat: "v0",
      targetFormat: "v1",
      alreadyMigrated: true,
      entityCounts: {
        nodes: nodes.length,
        edges: edges.length,
        notices: notices.length,
      },
      sourceFiles: files,
    };
  }

  // 1. Dry Run Execution: No disk mutations, no locking required
  if (options.dryRun) {
    if (marker && markedManifest) {
      return {
        dryRun: true,
        migrationId: marker.migrationId,
        sourceFormat: "v0",
        targetFormat: "v1",
        entityCounts: marker.entityCounts,
        sourceFiles: marker.sourceFiles,
        targetFiles: marker.targetFiles,
      };
    }

    const files = await collectSourceFiles(canonicalRoot);
    const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
    const noticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
    const statePath = path.join(canonicalRoot, "STATE.yaml");

    const { items: graphItems, nodes, edges } = await parseAndValidateLegacyGraph(graphPath);
    const { notices } = await parseAndValidateLegacyNotices(noticesPath);
    await parseAndValidateLegacyState(statePath);

    const migrationId = options.migrationId ?? interruptedManifest?.migrationId ?? generateMigrationId();

    const predictedTarget: Record<string, PredictedFileStats> = {};

    if (files["GRAPH.jsonl"]) {
      const estimatedSizeBytes = files["GRAPH.jsonl"].sizeBytes + graphItems.length * 140;
      predictedTarget["GRAPH.jsonl"] = {
        estimatedRecords: graphItems.length,
        estimatedSizeBytes,
      };
    }

    if (files["NOTICES.jsonl"]) {
      const estimatedSizeBytes = files["NOTICES.jsonl"].sizeBytes + notices.length * 140;
      predictedTarget["NOTICES.jsonl"] = {
        estimatedRecords: notices.length,
        estimatedSizeBytes,
      };
    }

    if (files["STATE.yaml"]) {
      predictedTarget["STATE.yaml"] = {
        estimatedRecords: 1,
        estimatedSizeBytes: files["STATE.yaml"].sizeBytes + 40,
      };
    }

    predictedTarget["INDEX.md"] = {
      estimatedRecords: 1,
      estimatedSizeBytes: 1024 + nodes.length * 80,
    };

    if (nodes.length > 0) {
      predictedTarget["cards/*.md"] = {
        estimatedRecords: nodes.length,
        estimatedSizeBytes: nodes.length * 350,
      };
    }

    return {
      dryRun: true,
      migrationId,
      sourceFormat: "v0",
      targetFormat: "v1",
      entityCounts: {
        nodes: nodes.length,
        edges: edges.length,
        notices: notices.length,
      },
      sourceFiles: files,
      predictedTarget,
    };
  }

  // 2. Full Migration under Root Lock
  return withRootLock(canonicalRoot, async () => {
    const durableMarker = await readMigrationMarker(canonicalRoot);
    if (durableMarker) {
      const durableManifest = await readMarkedMigration(canonicalRoot, durableMarker);
      if (durableMarker.phase === "ROLLING_BACK" || durableMarker.phase === "ROLLED_BACK") {
        throw pathError(
          "CORRUPT_PERSISTED_HISTORY",
          `Migration '${durableMarker.migrationId}' is in rollback recovery; retry rollback before migrating.`,
          MIGRATION_MARKER_FILE,
        );
      }
      await executeMigrationSwap(
        canonicalRoot,
        path.join(canonicalRoot, "staging", durableMarker.migrationId),
        durableMarker,
      );
      return {
        dryRun: false,
        migrationId: durableMarker.migrationId,
        sourceFormat: "v0",
        targetFormat: "v1",
        entityCounts: durableManifest.entityCounts,
        sourceFiles: durableManifest.files,
        targetFiles: durableManifest.targetFiles,
        backupPath: path.join(canonicalRoot, "backups", durableMarker.migrationId),
        stagingPath: path.join(canonicalRoot, "staging", durableMarker.migrationId),
      };
    }

    const migrationId = options.migrationId ?? interruptedManifest?.migrationId ?? generateMigrationId();
    const backupDir = path.join(canonicalRoot, "backups", migrationId);
    const stagingDir = path.join(canonicalRoot, "staging", migrationId);

    // Source validation & ingestion
    const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
    const noticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
    const statePath = path.join(canonicalRoot, "STATE.yaml");

    const sourceFiles = await collectSourceFiles(canonicalRoot);
    const { items: graphItems, nodes: sourceNodes, edges: sourceEdges } =
      await parseAndValidateLegacyGraph(graphPath);
    const { notices: sourceNotices, items: noticeItems } =
      await parseAndValidateLegacyNotices(noticesPath);
    const sourceState = await parseAndValidateLegacyState(statePath);

    const entityCounts: MigrationEntityCounts = {
      nodes: sourceNodes.length,
      edges: sourceEdges.length,
      notices: sourceNotices.length,
    };

    // Step A: Create Immutable Backup (if not already completed by prior attempt)
    const backupManifestPath = path.join(backupDir, "manifest.json");
    let manifest: MigrationManifest;

    await assertMigrationPath(canonicalRoot, backupDir, "directory", false);
    if (fs.existsSync(backupManifestPath)) {
      manifest = await readManifestAt(
        canonicalRoot,
        backupManifestPath,
        migrationId,
        `backup manifest for migration '${migrationId}'`,
      );
      const sourceMatches =
        fileTableFingerprint(manifest.files) === fileTableFingerprint(sourceFiles) &&
        JSON.stringify(manifest.entityCounts) === JSON.stringify(entityCounts);
      if (!sourceMatches && (manifest.status !== "STAGED" || !fileTableIsSubset(manifest.files, sourceFiles))) {
        throw pathError(
          "CORRUPT_PERSISTED_HISTORY",
          `Backup manifest for migration '${migrationId}' does not match the current source.`,
          backupManifestPath,
        );
      }
      await validateBackupSnapshot(
        canonicalRoot,
        backupDir,
        manifest,
        manifest.status === "STAGED" && manifest.targetFiles === undefined,
      );
      if (!sourceMatches) {
        for (const [relativePath, fileInfo] of Object.entries(sourceFiles)) {
          const sourcePath = path.join(canonicalRoot, ...relativePath.split("/"));
          const backupPath = path.join(backupDir, ...relativePath.split("/"));
          const existingBackupPath = await assertMigrationPath(canonicalRoot, backupPath, "file", false);
          if (fs.existsSync(existingBackupPath)) {
            await verifyFileDigest(existingBackupPath, fileInfo, `Backup file '${relativePath}'`);
            continue;
          }
          // An interrupted run may have persisted the manifest before
          // copying every source file. Repair that durable snapshot before
          // promoting the migration to COMPLETE; the manifest key alone is
          // not evidence that its backup payload exists.
          await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
          await fs.promises.copyFile(sourcePath, backupPath);
          await verifyFileDigest(backupPath, fileInfo, `Backup file '${relativePath}'`);
        }
        manifest.files = sourceFiles;
        manifest.entityCounts = entityCounts;
        await writeManifest(canonicalRoot, backupManifestPath, manifest);
        await validateBackupSnapshot(canonicalRoot, backupDir, manifest);
      }
    } else {
      if (fs.existsSync(backupDir)) {
        const existingBackupFiles = await collectAndValidateTree(canonicalRoot, backupDir);
        if (Object.keys(existingBackupFiles).length > 0) {
          throw pathError(
            "CORRUPT_PERSISTED_HISTORY",
            `Migration backup '${migrationId}' contains files but no manifest.`,
            backupDir,
          );
        }
      }
      await fs.promises.mkdir(backupDir, { recursive: true });

      // Verbatim copy of all source files
      for (const [relPath, fileInfo] of Object.entries(sourceFiles)) {
        const srcFile = path.join(canonicalRoot, relPath);
        const destFile = path.join(backupDir, relPath);
        await fs.promises.mkdir(path.dirname(destFile), { recursive: true });
        await fs.promises.copyFile(srcFile, destFile);

        // Verify copy hash
        const copyHash = await computeFileDigest(destFile);
        if (copyHash.sha256 !== fileInfo.sha256) {
          throw new AriadneError({
            code: "CORRUPT_PERSISTED_HISTORY",
            message: `Backup verification failed for '${relPath}': hash mismatch.`,
            repair: "Inspect disk or filesystem permissions.",
          });
        }
      }

      manifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: sourceFiles,
        entityCounts,
      };

      await writeManifest(canonicalRoot, backupManifestPath, manifest);

      // Ensure .ariadne/backups/ is listed in .gitignore
      await ensureBackupsInGitignore(canonicalRoot);
    }

    // Step B: Build Successor V1 Files in Staging Area
    await assertMigrationPath(canonicalRoot, stagingDir, "directory", false);
    await fs.promises.mkdir(stagingDir, { recursive: true });

    // 1. Frame GRAPH.jsonl
    const stagedGraphFrames: FramedRecord[] = [];
    let graphSeq = 1;
    for (const item of graphItems) {
      const frame = createFramedRecord({
        payload: item.event,
        sequence: graphSeq++,
        idempotencyKey: item.idempotencyKey,
        timestamp: item.originalTimestamp ?? new Date().toISOString(),
      });
      stagedGraphFrames.push(frame);
    }

    const stagedGraphContent =
      stagedGraphFrames.length > 0
        ? stagedGraphFrames.map((f) => JSON.stringify(f)).join("\n") + "\n"
        : "";
    await fs.promises.writeFile(
      path.join(stagingDir, "GRAPH.jsonl"),
      stagedGraphContent,
      "utf8",
    );

    // 2. Frame NOTICES.jsonl (if present in source)
    if (sourceFiles["NOTICES.jsonl"] !== undefined) {
      const stagedNoticeFrames: FramedRecord[] = [];
      let noticeSeq = 1;
      for (const item of noticeItems) {
        const frame = createFramedRecord({
          payload: item.notice,
          sequence: noticeSeq++,
          idempotencyKey: `operational-notice:${item.notice.falsified_id}:${item.notice.evidence_id}`,
          timestamp: item.timestamp ?? item.notice.created_at ?? new Date().toISOString(),
        });
        stagedNoticeFrames.push(frame);
      }

      const stagedNoticesContent =
        stagedNoticeFrames.length > 0
          ? stagedNoticeFrames.map((f) => JSON.stringify(f)).join("\n") + "\n"
          : "";
      await fs.promises.writeFile(
        path.join(stagingDir, "NOTICES.jsonl"),
        stagedNoticesContent,
        "utf8",
      );
    }

    // 3. Materialize graph & generate INDEX.md and cards/
    const graphEvents = stagedGraphFrames.map((f) => f.payload as GraphEvent);
    const materializedGraph: MaterializedGraph = applyEvents({ nodes: [], edges: [] }, graphEvents);

    const indexContent = renderIndex(materializedGraph);
    await fs.promises.writeFile(path.join(stagingDir, "INDEX.md"), indexContent, "utf8");

    const stagingCardsDir = path.join(stagingDir, "cards");
    await fs.promises.mkdir(stagingCardsDir, { recursive: true });
    for (const node of materializedGraph.nodes) {
      const cardContent = renderCard(node);
      await fs.promises.writeFile(
        path.join(stagingCardsDir, `${node.id}.md`),
        cardContent,
        "utf8",
      );
    }

    // 4. Update and write STATE.yaml (preserving overlay fields)
    const baseState: Record<string, unknown> = sourceState ? { ...sourceState } : {};
    const nextState = stateForGraph(baseState, materializedGraph);
    nextState.schema_version = 1;

    const stateContent = JSON.stringify(nextState, null, 2) + "\n";
    await fs.promises.writeFile(path.join(stagingDir, "STATE.yaml"), stateContent, "utf8");

    // Copy any unmanaged source files (e.g. GRILL-SUBSTRATE.md, custom docs) into staging
    for (const relPath of Object.keys(sourceFiles)) {
      if (
        relPath === "GRAPH.jsonl" ||
        relPath === "NOTICES.jsonl" ||
        relPath === "STATE.yaml" ||
        relPath === "INDEX.md" ||
        relPath.startsWith("cards/")
      ) {
        continue;
      }
      const src = path.join(canonicalRoot, relPath);
      const dest = path.join(stagingDir, relPath);
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
    }

    // Step C: Invariant Verification
    // Assert 100% preservation of nodes and edges
    if (materializedGraph.nodes.length !== sourceNodes.length) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Node count mismatch during migration: source had ${sourceNodes.length}, staged has ${materializedGraph.nodes.length}`,
      });
    }

    if (materializedGraph.edges.length !== sourceEdges.length) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Edge count mismatch during migration: source had ${sourceEdges.length}, staged has ${materializedGraph.edges.length}`,
      });
    }

    if (stagedGraphFrames.length !== graphItems.length) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Graph record count mismatch during migration: source had ${graphItems.length}, staged has ${stagedGraphFrames.length}`,
      });
    }

    const stagedNodeIds = new Set(materializedGraph.nodes.map((n) => n.id));
    for (const srcNode of sourceNodes) {
      if (!stagedNodeIds.has(srcNode.id)) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: `Node ID '${srcNode.id}' missing in migrated staging set.`,
        });
      }
    }

    // Record target file stats for every staged file, including unmanaged data.
    // This keeps the swap plan and recovery marker complete rather than silently
    // leaving a staged copy of a supported source file unused.
    const targetFiles: Record<string, MigrationFileEntry> = {};
    const stagedFiles = await collectAndValidateTree(canonicalRoot, stagingDir);
    for (const [relativePath, fileInfo] of Object.entries(stagedFiles)) {
      if (relativePath !== "manifest.json") targetFiles[relativePath] = fileInfo;
    }

    manifest.status = "COMPLETE";
    manifest.targetFiles = targetFiles;

    await writeManifest(canonicalRoot, backupManifestPath, manifest);
    await writeManifest(canonicalRoot, path.join(stagingDir, "manifest.json"), manifest);

    // Step D: Durable marker followed by resumable atomic swaps.
    const marker = markerFromManifest(manifest, targetFiles);
    marker.phase = "SWAPPING";
    await writeMigrationMarker(canonicalRoot, marker);
    await executeMigrationSwap(canonicalRoot, stagingDir, marker);

    return {
      dryRun: false,
      migrationId,
      sourceFormat: "v0",
      targetFormat: "v1",
      entityCounts,
      sourceFiles,
      targetFiles,
      backupPath: backupDir,
      stagingPath: stagingDir,
    };
  });
}

/**
 * Safely rolls back a workspace from an immutable backup snapshot.
 *
 * Acquires root lock, locates .ariadne/backups/<id>/,
 * verifies manifest.json and SHA-256 hashes of backed-up files,
 * and atomically restores live workspace to original v0 state.
 */
export async function rollbackMigration(
  storageRoot: string,
  migrationId: string,
): Promise<RollbackResult> {
  const canonicalRoot = canonicalizePath(storageRoot);

  if (!migrationId || !MIGRATION_ID_PATTERN.test(migrationId)) {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Invalid migration ID for rollback: '${migrationId}'`,
      repair: "Provide a valid migration ID without special characters.",
    });
  }

  return withRootLock(canonicalRoot, async () => {
    const backupDir = path.join(canonicalRoot, "backups", migrationId);
    await assertMigrationPath(canonicalRoot, backupDir, "directory", false);
    try {
      await fs.promises.access(backupDir);
    } catch (error: unknown) {
      if (!isNodeError(error, "ENOENT")) throw error;
      throw new AriadneError({
        code: "MISSING_DATA",
        message: `Backup snapshot for migration ID '${migrationId}' was not found at '${backupDir}'.`,
        repair: "Check available backups in '.ariadne/backups/'.",
        detail: { migrationId, backupDir },
      });
    }

    const marker = await readMigrationMarker(canonicalRoot);
    if (marker && marker.migrationId !== migrationId) {
      throw pathError(
        "CORRUPT_PERSISTED_HISTORY",
        `Durable migration marker belongs to '${marker.migrationId}', not '${migrationId}'.`,
        MIGRATION_MARKER_FILE,
      );
    }

    const manifest = marker
      ? await readMarkedMigration(canonicalRoot, marker)
      : await readManifestAt(
          canonicalRoot,
          path.join(backupDir, "manifest.json"),
          migrationId,
          `backup manifest for migration '${migrationId}'`,
        );
    const targetFiles = manifest.targetFiles ?? marker?.targetFiles ?? {};

    // All rollback inputs and cleanup paths are checked before the durable
    // rollback marker is created. A bad backup or live tree therefore cannot
    // produce a partially restored workspace.
    await validateBackupSnapshot(canonicalRoot, backupDir, manifest);
    await validateRollbackLiveState(canonicalRoot, manifest, targetFiles);

    const rollbackMarker: MigrationMarker = marker
      ? {
          ...marker,
          phase: marker.phase === "ROLLING_BACK" || marker.phase === "ROLLED_BACK" ? marker.phase : "ROLLING_BACK",
          swapPlan:
            marker.phase === "ROLLING_BACK" || marker.phase === "ROLLED_BACK"
              ? marker.swapPlan
              : buildRollbackPlan(marker.sourceFiles, marker.targetFiles),
          nextStep: marker.phase === "ROLLING_BACK" || marker.phase === "ROLLED_BACK" ? marker.nextStep : 0,
        }
      : {
          schemaVersion: 1,
          migrationId,
          phase: "ROLLING_BACK",
          sourceFiles: manifest.files,
          targetFiles,
          entityCounts: manifest.entityCounts,
          swapPlan: buildRollbackPlan(manifest.files, targetFiles),
          nextStep: 0,
        };

    const restoredFiles = await executeRollback(canonicalRoot, backupDir, manifest, rollbackMarker);

    return {
      migrationId,
      restoredFiles,
      status: "ROLLED_BACK",
    };
  });
}
