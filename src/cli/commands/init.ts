import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertNoShadowState,
  detectGsd,
  type GsdEnvironment,
} from "../../adapters/gsd/detector.js";
import { GraphStorage } from "../../graph/storage.js";
import { toRootRelative } from "../../core/root-relative.js";
import { hasHelp } from "../workspace.js";
import type { CliIO } from "./status.js";

export type InitMode = "auto" | "standalone" | "gsd";

const MANAGED_FILES = ["STATE.yaml", "GRAPH.jsonl", "INDEX.md"] as const;

const initialState = (environment: GsdEnvironment) => ({
  schema_version: 1,
  mode: environment.active ? "gsd" : "standalone",
  depth_mode: "Standard",
  frontier: [],
  open_unknowns: [],
});

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const INIT_USAGE = "Usage: ariadne init [--mode auto|standalone|gsd] [--force]\n";

const parse = (args: readonly string[]): { mode: InitMode; force: boolean } => {
  let mode: InitMode = "auto";
  let modeSet = false;
  let force = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      if (force) throw new Error(INIT_USAGE.trim());
      force = true;
      continue;
    }
    if (arg === "--mode" || arg.startsWith("--mode=")) {
      if (modeSet) throw new Error(INIT_USAGE.trim());
      const value = arg === "--mode" ? args[++index] : arg.slice("--mode=".length);
      if (value !== "auto" && value !== "standalone" && value !== "gsd") {
        throw new Error(INIT_USAGE.trim());
      }
      mode = value;
      modeSet = true;
      continue;
    }
    throw new Error(INIT_USAGE.trim());
  }
  return { mode, force };
};

const environmentFor = (root: string, mode: InitMode): GsdEnvironment => {
  if (mode === "standalone") return detectGsd(root, { override: false });
  if (mode === "gsd") return detectGsd(root, { override: true });
  return detectGsd(root);
};

export async function runInit(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args, ["--mode"])) {
    io.stdout.write(INIT_USAGE);
    return 0;
  }
  const { mode, force } = parse(args);
  const environment = environmentFor(io.cwd, mode);
  if (environment.active) assertNoShadowState(environment);

  const storage = new GraphStorage(environment.storageRoot);
  const existing = (await Promise.all(MANAGED_FILES.map((name) => exists(join(storage.rootDirectory, name)))))
    .some(Boolean);
  if (existing && !force) {
    throw new Error(
      `Ariadne workspace is already initialized at ${storage.rootDirectory}; use --force to replace managed files`,
    );
  }

  await mkdir(storage.rootDirectory, { recursive: true });
  await storage.writeState(initialState(environment));
  await writeFile(storage.graphPath, "", "utf8");
  await storage.regenerateIndex();

  io.stdout.write(
    `${JSON.stringify({
      mode: environment.active ? "gsd" : "standalone",
      storage_root: toRootRelative(io.cwd, storage.rootDirectory),
      files: [...MANAGED_FILES],
      force,
    })}\n`,
  );
  return 0;
}
