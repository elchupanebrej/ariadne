import path from "node:path";
import fs from "node:fs";
import { findCliWorkspaceRoot, hasHelp, type CliIO } from "../workspace.js";
import { detectGsd } from "../../adapters/gsd/detector.js";
import {
  migrateWorkspace,
  rollbackMigration,
  type MigrationResult,
  type RollbackResult,
} from "../../graph/migration.js";
import { AriadneError } from "../../core/errors.js";

const MIGRATE_USAGE = `Usage:
  ariadne migrate [--dry-run] [--rollback <migration-id>] [--json]

Options:
  --dry-run                 Preview migration changes without modifying disk
  --rollback <migration-id> Restore workspace from an immutable backup snapshot
  --json                    Output structured JSON
  -h, --help                Show this help
`;

export interface ParsedMigrateArgs {
  dryRun: boolean;
  rollbackId?: string;
  json: boolean;
}

export function parseMigrateArgs(args: readonly string[]): ParsedMigrateArgs {
  let dryRun = false;
  let rollbackId: string | undefined = undefined;
  let json = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--json" || arg === "--format=json") {
      json = true;
    } else if (arg === "--format" && args[i + 1] === "json") {
      json = true;
      i += 1;
    } else if (arg === "--rollback") {
      const nextArg = args[i + 1];
      if (!nextArg || nextArg.startsWith("--")) {
        throw new AriadneError({
          code: "INVALID_INPUT",
          message: "Flag --rollback requires a migration ID argument",
          repair: "Specify the migration ID to restore: 'ariadne migrate --rollback <id>'",
        });
      }
      rollbackId = nextArg;
      i += 1;
    } else if (arg.startsWith("--rollback=")) {
      const val = arg.slice("--rollback=".length);
      if (!val) {
        throw new AriadneError({
          code: "INVALID_INPUT",
          message: "Flag --rollback requires a migration ID argument",
          repair: "Specify the migration ID to restore: 'ariadne migrate --rollback=<id>'",
        });
      }
      rollbackId = val;
    } else {
      throw new AriadneError({
        code: "INVALID_INPUT",
        message: `Unknown argument for migrate: '${arg}'`,
        repair: "Run 'ariadne migrate --help' to see valid options.",
      });
    }
  }

  return { dryRun, rollbackId, json };
}

export async function runMigrate(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(MIGRATE_USAGE);
    return 0;
  }

  const { dryRun, rollbackId, json } = parseMigrateArgs(args);

  const workspaceRoot = findCliWorkspaceRoot(io.cwd);
  const environment = detectGsd(workspaceRoot);
  const storageRoot = environment.storageRoot;

  if (!fs.existsSync(storageRoot)) {
    throw new AriadneError({
      code: "MISSING_DATA",
      message: `Ariadne workspace directory not found at '${storageRoot}'`,
      repair: "Run 'ariadne init' to initialize a workspace.",
      detail: { storageRoot },
    });
  }

  if (rollbackId !== undefined) {
    const result: RollbackResult = await rollbackMigration(storageRoot, rollbackId);

    if (json) {
      io.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } else {
      const lines = [
        "Rollback Completed Successfully!",
        `  Migration ID: ${result.migrationId}`,
        "  Restored Files:",
        ...result.restoredFiles.map((f) => `    - ${f}`),
        "  Workspace has been restored to its original v0 state.",
      ];
      io.stdout.write(lines.join("\n") + "\n");
    }
    return 0;
  }

  const result: MigrationResult = await migrateWorkspace(storageRoot, { dryRun });

  if (json) {
    io.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return 0;
  }

  if (result.alreadyMigrated) {
    io.stdout.write("Workspace is already at format version v1. No migration needed.\n");
    return 0;
  }

  if (result.dryRun) {
    const lines = [
      "Migration Dry Run Summary:",
      `  Workspace: ${path.relative(io.cwd, storageRoot) || storageRoot}`,
      "  Status: Ready to migrate (v0 -> v1)",
      `  Nodes: ${result.entityCounts.nodes}`,
      `  Edges: ${result.entityCounts.edges}`,
      `  Notices: ${result.entityCounts.notices}`,
      "  Source Files:",
      ...Object.entries(result.sourceFiles).map(
        ([file, info]) => `    - ${file} (${info.sizeBytes} bytes, sha256: ${info.sha256.slice(0, 12)}...)`,
      ),
    ];

    if (result.predictedTarget && Object.keys(result.predictedTarget).length > 0) {
      lines.push("  Target Prediction:");
      for (const [file, pred] of Object.entries(result.predictedTarget)) {
        lines.push(`    - ${file} (${pred.estimatedRecords} records, ~${pred.estimatedSizeBytes} bytes)`);
      }
    }

    lines.push("  No files were written to disk.");
    io.stdout.write(lines.join("\n") + "\n");
    return 0;
  }

  const lines = [
    "Migration Completed Successfully!",
    `  Migration ID: ${result.migrationId}`,
    `  Workspace: ${path.relative(io.cwd, storageRoot) || storageRoot}`,
    "  Format: v0 -> v1",
    `  Nodes Migrated: ${result.entityCounts.nodes}`,
    `  Edges Migrated: ${result.entityCounts.edges}`,
    `  Notices Migrated: ${result.entityCounts.notices}`,
  ];

  if (result.backupPath) {
    lines.push(`  Backup Created: ${path.relative(io.cwd, result.backupPath) || result.backupPath}/`);
  }

  lines.push("  Active Files Swapped: GRAPH.jsonl, NOTICES.jsonl, STATE.yaml, INDEX.md, cards/");
  io.stdout.write(lines.join("\n") + "\n");

  return 0;
}
