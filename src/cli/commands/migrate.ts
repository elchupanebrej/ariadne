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
import { parseOptions, parseOutputFormat, syntaxError } from "../contract.js";

const MIGRATE_USAGE = `Usage:
  ariadne migrate [--dry-run] [--rollback <id>]

Options:
  --dry-run                 Preview migration changes without modifying disk
  --rollback <id>           Restore workspace from an immutable backup snapshot
  -h, --help                Show this help
`;

export interface ParsedMigrateArgs {
  dryRun: boolean;
  rollbackId?: string;
  json: boolean;
}

export function parseMigrateArgs(args: readonly string[]): ParsedMigrateArgs {
  const output = parseOutputFormat(args, ["json"], "human", MIGRATE_USAGE.trim());
  const compatibilityJson = output.rest.filter((arg) => arg === "--json");
  const withoutCompatibilityJson = output.rest.filter((arg) => arg !== "--json");
  if (compatibilityJson.length > 1 || (compatibilityJson.length === 1 && output.format === "json")) {
    throw syntaxError("Specify only one JSON output option.");
  }
  const normalized = withoutCompatibilityJson.flatMap((arg) => {
    if (arg.startsWith("--rollback=")) return ["--rollback", arg.slice("--rollback=".length)];
    return [arg];
  });
  const parsed = parseOptions(
    normalized,
    [
      { name: "dry-run" },
      { name: "rollback", takesValue: true },
    ],
    MIGRATE_USAGE.trim(),
  );
  if (parsed.positionals.length > 0) throw syntaxError(MIGRATE_USAGE.trim());
  const dryRun = parsed.flags.has("dry-run");
  const rollbackId = parsed.values.get("rollback");
  if (rollbackId !== undefined && rollbackId.trim() === "") {
    throw syntaxError("Option --rollback requires a migration ID.");
  }
  if (dryRun && rollbackId !== undefined) {
    throw syntaxError("Options --dry-run and --rollback cannot be used together.");
  }
  return {
    dryRun,
    ...(rollbackId === undefined ? {} : { rollbackId }),
    json: output.format === "json" || compatibilityJson.length === 1,
  };
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
