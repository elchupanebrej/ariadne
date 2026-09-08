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

/**
 * Recursively collects all regular files beneath canonicalRoot,
 * skipping .lock, backups/, and staging/ subdirectories.
 * Returns relative POSIX paths mapped to their SHA-256 and sizeBytes.
 */
export async function collectSourceFiles(
  canonicalRoot: string,
): Promise<Record<string, MigrationFileEntry>> {
  const files: Record<string, MigrationFileEntry> = {};

  async function walk(currentDir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "ENOENT"
      ) {
        return;
      }
      throw err;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      const rel = path.relative(canonicalRoot, entryPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        if (rel === ".lock" || rel === "backups" || rel === "staging") {
          continue;
        }
        await walk(entryPath);
      } else if (entry.isFile()) {
        if (rel.startsWith(".lock/") || rel.startsWith("backups/") || rel.startsWith("staging/")) {
          continue;
        }
        if (entry.name.startsWith(".tmp.") || entry.name.endsWith(".tmp")) {
          continue;
        }
        const fileEntry = await computeFileDigest(entryPath);
        files[rel] = fileEntry;
      }
    }
  }

  await walk(canonicalRoot);
  return files;
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

/**
 * Checks whether an interrupted staging directory exists and verifies live source files
 * against its manifest.
 * If source files match, returns the prior manifest; if altered, throws CORRUPT_PERSISTED_HISTORY.
 */
async function checkInterruptedStaging(
  canonicalRoot: string,
  preferredMigrationId?: string,
): Promise<MigrationManifest | null> {
  const stagingRoot = path.join(canonicalRoot, "staging");
  let subdirs: string[] = [];
  try {
    const entries = await fs.promises.readdir(stagingRoot, { withFileTypes: true });
    subdirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return null;
  }

  if (subdirs.length === 0) {
    return null;
  }

  const candidateId = preferredMigrationId && subdirs.includes(preferredMigrationId)
    ? preferredMigrationId
    : subdirs[subdirs.length - 1];

  let manifestPath = path.join(stagingRoot, candidateId, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(canonicalRoot, "backups", candidateId, "manifest.json");
  }

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  let manifest: MigrationManifest;
  try {
    const raw = await fs.promises.readFile(manifestPath, "utf8");
    manifest = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!manifest || manifest.sourceFormat !== "v0" || !manifest.files) {
    return null;
  }

  // Verify all source files in live workspace match manifest.files
  for (const [relPath, fileInfo] of Object.entries(manifest.files)) {
    const livePath = path.join(canonicalRoot, relPath);
    if (!fs.existsSync(livePath)) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Source file '${relPath}' was removed since interrupted migration '${manifest.migrationId}'`,
        repair: `Restore workspace from backup '.ariadne/backups/${manifest.migrationId}' or remove corrupted staging directory.`,
        detail: { migrationId: manifest.migrationId, file: relPath },
      });
    }

    const currentDigest = await computeFileDigest(livePath);
    if (currentDigest.sha256 !== fileInfo.sha256) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Source file '${relPath}' was altered since interrupted migration '${manifest.migrationId}'`,
        repair: `Restore workspace from backup '.ariadne/backups/${manifest.migrationId}' or remove corrupted staging directory.`,
        detail: {
          migrationId: manifest.migrationId,
          file: relPath,
          expectedSha256: fileInfo.sha256,
          actualSha256: currentDigest.sha256,
        },
      });
    }
  }

  return manifest;
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

  // Check if interrupted staging exists
  const interruptedManifest = await checkInterruptedStaging(canonicalRoot, options.migrationId);

  // Check legacy status
  const legacy = await isLegacyWorkspace(canonicalRoot);
  if (!legacy && !interruptedManifest) {
    const files = await collectSourceFiles(canonicalRoot);
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
    const migrationId = options.migrationId ?? interruptedManifest?.migrationId ?? generateMigrationId();
    const backupDir = path.join(canonicalRoot, "backups", migrationId);
    const stagingDir = path.join(canonicalRoot, "staging", migrationId);

    // Source validation & ingestion
    const graphPath = path.join(canonicalRoot, "GRAPH.jsonl");
    const noticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
    const statePath = path.join(canonicalRoot, "STATE.yaml");

    const { items: graphItems, nodes: sourceNodes, edges: sourceEdges } =
      await parseAndValidateLegacyGraph(graphPath);
    const { notices: sourceNotices, items: noticeItems } =
      await parseAndValidateLegacyNotices(noticesPath);
    const sourceState = await parseAndValidateLegacyState(statePath);

    const sourceFiles = await collectSourceFiles(canonicalRoot);

    const entityCounts: MigrationEntityCounts = {
      nodes: sourceNodes.length,
      edges: sourceEdges.length,
      notices: sourceNotices.length,
    };

    // Step A: Create Immutable Backup (if not already completed by prior attempt)
    const backupManifestPath = path.join(backupDir, "manifest.json");
    let manifest: MigrationManifest;

    if (fs.existsSync(backupManifestPath)) {
      try {
        manifest = JSON.parse(await fs.promises.readFile(backupManifestPath, "utf8"));
      } catch {
        manifest = {
          migrationId,
          createdAt: new Date().toISOString(),
          sourceFormat: "v0",
          targetFormat: "v1",
          status: "STAGED",
          files: sourceFiles,
          entityCounts,
        };
      }
    } else {
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

      await fs.promises.writeFile(
        backupManifestPath,
        JSON.stringify(manifest, null, 2) + "\n",
        "utf8",
      );

      // Ensure .ariadne/backups/ is listed in .gitignore
      await ensureBackupsInGitignore(canonicalRoot);
    }

    // Step B: Build Successor V1 Files in Staging Area
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

    // Record target file stats
    const targetFiles: Record<string, MigrationFileEntry> = {};
    targetFiles["GRAPH.jsonl"] = await computeFileDigest(path.join(stagingDir, "GRAPH.jsonl"));
    if (sourceFiles["NOTICES.jsonl"] !== undefined) {
      targetFiles["NOTICES.jsonl"] = await computeFileDigest(path.join(stagingDir, "NOTICES.jsonl"));
    }
    targetFiles["STATE.yaml"] = await computeFileDigest(path.join(stagingDir, "STATE.yaml"));
    targetFiles["INDEX.md"] = await computeFileDigest(path.join(stagingDir, "INDEX.md"));

    manifest.status = "COMPLETE";
    manifest.targetFiles = targetFiles;

    await fs.promises.writeFile(
      backupManifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
    await fs.promises.writeFile(
      path.join(stagingDir, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );

    // Step D: Atomic Swap
    // 1. Swap GRAPH.jsonl
    await fs.promises.rename(
      path.join(stagingDir, "GRAPH.jsonl"),
      path.join(canonicalRoot, "GRAPH.jsonl"),
    );

    // 2. Swap NOTICES.jsonl (if staged)
    if (sourceFiles["NOTICES.jsonl"] !== undefined) {
      await fs.promises.rename(
        path.join(stagingDir, "NOTICES.jsonl"),
        path.join(canonicalRoot, "NOTICES.jsonl"),
      );
    }

    // 3. Swap STATE.yaml
    await fs.promises.rename(
      path.join(stagingDir, "STATE.yaml"),
      path.join(canonicalRoot, "STATE.yaml"),
    );

    // 4. Swap INDEX.md
    await fs.promises.rename(
      path.join(stagingDir, "INDEX.md"),
      path.join(canonicalRoot, "INDEX.md"),
    );

    // 5. Swap cards/ directory
    const liveCardsDir = path.join(canonicalRoot, "cards");
    if (fs.existsSync(stagingCardsDir)) {
      if (fs.existsSync(liveCardsDir)) {
        const oldCardsTemp = path.join(canonicalRoot, `.old.cards.${Date.now()}.${randomUUID().slice(0, 6)}`);
        await fs.promises.rename(liveCardsDir, oldCardsTemp);
        await fs.promises.rename(stagingCardsDir, liveCardsDir);
        await fs.promises.rm(oldCardsTemp, { recursive: true, force: true }).catch(() => {});
      } else {
        await fs.promises.rename(stagingCardsDir, liveCardsDir);
      }
    }

    // Clean up staging directory
    await fs.promises.rm(stagingDir, { recursive: true, force: true }).catch(() => {});

    // Verify live workspace is recognized as V1
    const postCheckLegacy = await isLegacyWorkspace(canonicalRoot);
    if (postCheckLegacy) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: "Post-migration check failed: workspace is still detected as legacy v0.",
        repair: "Inspect .ariadne/GRAPH.jsonl and STATE.yaml or restore from backup.",
      });
    }

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

  if (!migrationId || !/^[A-Za-z0-9_-]+$/.test(migrationId)) {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Invalid migration ID for rollback: '${migrationId}'`,
      repair: "Provide a valid migration ID without special characters.",
    });
  }

  return withRootLock(canonicalRoot, async () => {
    const backupDir = path.join(canonicalRoot, "backups", migrationId);

    if (!fs.existsSync(backupDir)) {
      throw new AriadneError({
        code: "MISSING_DATA",
        message: `Backup snapshot for migration ID '${migrationId}' was not found at '${backupDir}'.`,
        repair: "Check available backups in '.ariadne/backups/'.",
        detail: { migrationId, backupDir },
      });
    }

    const manifestPath = path.join(backupDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Backup manifest for migration '${migrationId}' is missing at '${manifestPath}'.`,
        repair: "Ensure manifest.json is present in the backup directory.",
        detail: { migrationId, manifestPath },
      });
    }

    let manifest: MigrationManifest;
    try {
      const raw = await fs.promises.readFile(manifestPath, "utf8");
      manifest = JSON.parse(raw);
    } catch (err) {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Failed to parse backup manifest for migration '${migrationId}': ${err instanceof Error ? err.message : String(err)}`,
        repair: "Ensure manifest.json in the backup directory is valid JSON.",
        detail: { migrationId, manifestPath },
      });
    }

    if (!manifest.files || typeof manifest.files !== "object") {
      throw new AriadneError({
        code: "CORRUPT_PERSISTED_HISTORY",
        message: `Backup manifest for migration '${migrationId}' has missing or invalid files table.`,
        repair: "Inspect manifest.json in the backup directory.",
      });
    }

    // Verify SHA-256 hashes of all backed-up files before restoring any file
    for (const [relPath, fileInfo] of Object.entries(manifest.files)) {
      const backupFilePath = path.join(backupDir, relPath);
      if (!fs.existsSync(backupFilePath)) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: `Backed-up file '${relPath}' is missing from '${backupDir}'.`,
          repair: "Restore missing file or choose another backup.",
          detail: { migrationId, file: relPath },
        });
      }

      const digest = await computeFileDigest(backupFilePath);
      if (digest.sha256 !== fileInfo.sha256) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: `Backed-up file '${relPath}' failed SHA-256 verification (corrupted backup).`,
          repair: "The backup directory has been tampered with or corrupted.",
          detail: {
            migrationId,
            file: relPath,
            expectedSha256: fileInfo.sha256,
            actualSha256: digest.sha256,
          },
        });
      }
    }

    const restoredFiles: string[] = [];

    // Atomically restore each file to live workspace root
    for (const relPath of Object.keys(manifest.files)) {
      const backupFilePath = path.join(backupDir, relPath);
      const targetLivePath = path.join(canonicalRoot, relPath);

      await fs.promises.mkdir(path.dirname(targetLivePath), { recursive: true });

      const tempSibling = path.join(
        path.dirname(targetLivePath),
        `.tmp.restore.${path.basename(targetLivePath)}.${process.pid}.${randomUUID().slice(0, 6)}`,
      );

      try {
        await fs.promises.copyFile(backupFilePath, tempSibling);
        await fs.promises.rename(tempSibling, targetLivePath);
        restoredFiles.push(relPath);
      } catch (err) {
        await fs.promises.unlink(tempSibling).catch(() => {});
        throw err;
      }
    }

    // Clean up files in live cards/ that were not in the v0 backup
    const liveCardsDir = path.join(canonicalRoot, "cards");
    if (fs.existsSync(liveCardsDir)) {
      const currentCards = await fs.promises.readdir(liveCardsDir);
      for (const cardFile of currentCards) {
        const cardRel = `cards/${cardFile}`;
        if (manifest.files[cardRel] === undefined) {
          await fs.promises.unlink(path.join(liveCardsDir, cardFile)).catch(() => {});
        }
      }
    }

    // If NOTICES.jsonl was not in the backup, remove it from live root
    if (manifest.files["NOTICES.jsonl"] === undefined) {
      const liveNoticesPath = path.join(canonicalRoot, "NOTICES.jsonl");
      if (fs.existsSync(liveNoticesPath)) {
        await fs.promises.unlink(liveNoticesPath).catch(() => {});
      }
    }

    // Verify all restored files in live workspace match original hashes
    for (const [relPath, fileInfo] of Object.entries(manifest.files)) {
      const liveFilePath = path.join(canonicalRoot, relPath);
      const liveDigest = await computeFileDigest(liveFilePath);
      if (liveDigest.sha256 !== fileInfo.sha256) {
        throw new AriadneError({
          code: "CORRUPT_PERSISTED_HISTORY",
          message: `Restored live file '${relPath}' failed verification after rollback.`,
          repair: "Inspect workspace permissions and re-run rollback.",
        });
      }
    }

    // Update manifest status to ROLLED_BACK in backup directory
    manifest.status = "ROLLED_BACK";
    await fs.promises.writeFile(
      manifestPath,
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );

    return {
      migrationId,
      restoredFiles,
      status: "ROLLED_BACK",
    };
  });
}
