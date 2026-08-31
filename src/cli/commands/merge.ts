import { access, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import {
  mergeBranchModels,
  MERGE_PROTOCOL_VERSION,
  type MergeReceipt,
} from "../../merge/three-way.js";
import { hasHelp, type CliIO } from "../workspace.js";

const MERGE_USAGE =
  "Usage: ariadne merge-driver [--json] [--protocol-version <n>] <ancestor> <current> <incoming>\n";

type ParsedArgs = {
  files: [string, string, string];
  json: boolean;
  protocolVersion: number;
};

const parseArgs = (args: readonly string[]): ParsedArgs => {
  const positionals: string[] = [];
  let json = false;
  let protocolVersion: number = MERGE_PROTOCOL_VERSION;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--protocol-version" || arg.startsWith("--protocol-version=")) {
      const value = arg === "--protocol-version" ? args[++index] : arg.slice("--protocol-version=".length);
      if (!value || !/^\d+$/u.test(value)) throw new Error(MERGE_USAGE.trim());
      protocolVersion = Number(value);
      continue;
    }
    if (arg.startsWith("--")) throw new Error(MERGE_USAGE.trim());
    positionals.push(arg);
  }
  if (positionals.length !== 3) throw new Error(MERGE_USAGE.trim());
  return { files: positionals as ParsedArgs["files"], json, protocolVersion };
};

const gitDirectory = async (cwd: string): Promise<string | undefined> => {
  let current = resolve(cwd);
  while (true) {
    const dotGit = join(current, ".git");
    try {
      const info = await stat(dotGit);
      if (info.isDirectory()) return dotGit;
      if (info.isFile()) {
        const content = await readFile(dotGit, "utf8");
        const match = content.match(/^gitdir:\s*(.+)\s*$/imu);
        if (!match) return undefined;
        return resolve(current, match[1]);
      }
    } catch {
      // Search the parent when this directory is not a Git worktree.
    }
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
};

const unsupportedOperation = async (cwd: string): Promise<string | undefined> => {
  if (process.env.ARIADNE_MERGE_DRIVER_ACTIVE === "1") return "recursive merge-driver invocation";
  const directory = await gitDirectory(cwd);
  if (!directory) return undefined;
  for (const [name, operation] of [
    ["rebase-merge", "rebase"],
    ["rebase-apply", "rebase"],
    ["CHERRY_PICK_HEAD", "cherry-pick"],
    ["REVERT_HEAD", "revert"],
  ] as const) {
    try {
      await access(join(directory, name));
      return operation;
    } catch {
      // The marker is absent; continue checking the supported operation.
    }
  }
  return undefined;
};

const replaceAtomically = async (path: string, content: string): Promise<void> => {
  const temporaryPath = `${path}.${randomUUID()}.ariadne-merge.tmp`;
  try {
    const mode = await stat(path).then((info) => info.mode).catch(() => undefined);
    await writeFile(temporaryPath, content, mode === undefined ? undefined : { mode });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const summary = (receipt: MergeReceipt): string => {
  const diagnostics = receipt.diagnostics.map(({ code }) => code).join(", ") || "none";
  return `Ariadne merge ${receipt.outcome} (protocol v${receipt.merge_protocol_version}); ` +
    `applied=${receipt.applied_subjects.length}; ` +
    `deduplicated=${receipt.deduplicated_subjects.length}; diagnostics=${diagnostics}\n`;
};

export async function runMergeDriver(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args, ["--protocol-version"])) {
    io.stdout.write(MERGE_USAGE);
    return 0;
  }
  const { files, json, protocolVersion } = parseArgs(args);
  const [basePath, currentPath, incomingPath] = files;
  const [base, current, incoming] = await Promise.all([
    readFile(basePath, "utf8"),
    readFile(currentPath, "utf8"),
    readFile(incomingPath, "utf8"),
  ]);
  const operation = await unsupportedOperation(io.cwd);
  const result = mergeBranchModels(
    { base, current, incoming },
    { protocolVersion, ...(operation ? { operation } : {}) },
  );
  if (result.receipt.outcome === "CLEAN" && result.output !== null) {
    await replaceAtomically(currentPath, result.output);
  }

  if (json) io.stdout.write(`${JSON.stringify(result.receipt)}\n`);
  io.stderr.write(summary(result.receipt));
  return result.receipt.outcome === "CLEAN" ? 0 : 1;
}

export { MERGE_USAGE };
