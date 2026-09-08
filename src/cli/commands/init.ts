import { access, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  assertNoShadowState,
  detectGsd,
  type GsdEnvironment,
} from "../../adapters/gsd/detector.js";
import { GraphStorage } from "../../graph/storage.js";
import { assertNotLegacyWorkspace } from "../../graph/legacy.js";
import { resetCanonicalAuthority, stageAndSwapProjection } from "../../graph/journal.js";
import { withRootLock } from "../../graph/lock.js";
import { renderIndex } from "../../graph/storage.js";
import { toRootRelative } from "../../core/root-relative.js";
import { hasHelp, parseOptions, syntaxError } from "../contract.js";
import type { CliIO } from "./status.js";

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

const INIT_USAGE = "Usage: ariadne init [--root <path>]\n";

type InitMode = "auto" | "standalone" | "gsd";

const parse = (args: readonly string[]): { root?: string; mode: InitMode; force: boolean } => {
  const parsed = parseOptions(
    args,
    [
      { name: "root", takesValue: true },
      { name: "mode", takesValue: true },
      { name: "force" },
    ],
    INIT_USAGE.trim(),
  );
  if (
    parsed.positionals.length > 0 ||
    [...parsed.flags].some((flag) => flag !== "force")
  ) {
    throw syntaxError(INIT_USAGE.trim());
  }
  const root = parsed.values.get("root");
  const requestedMode = parsed.values.get("mode") ?? "auto";
  if (requestedMode !== "auto" && requestedMode !== "standalone" && requestedMode !== "gsd") {
    throw syntaxError(`Unknown init mode: ${requestedMode}. ${INIT_USAGE.trim()}`);
  }
  return {
    ...(root === undefined ? {} : { root }),
    mode: requestedMode,
    force: parsed.flags.has("force"),
  };
};

export async function runInit(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(INIT_USAGE);
    return 0;
  }
  const { root: rootArg, mode, force } = parse(args);
  const root = rootArg === undefined ? io.cwd : resolve(io.cwd, rootArg);
  const environment =
    mode === "standalone"
      ? detectGsd(root, { override: false })
      : mode === "gsd"
        ? detectGsd(root, { override: true })
        : detectGsd(root);
  if (environment.active) assertNoShadowState(environment);

  const storage = new GraphStorage(environment.storageRoot);
  const existing = (await Promise.all(MANAGED_FILES.map((name) => exists(join(storage.rootDirectory, name)))))
    .some(Boolean);
  if (existing && !force) {
    throw syntaxError(
      `Ariadne workspace is already initialized at ${storage.rootDirectory}; use --force to replace managed files`,
    );
  }

  await withRootLock(storage.rootDirectory, async () => {
    await assertNotLegacyWorkspace(storage.rootDirectory);
    await mkdir(storage.rootDirectory, { recursive: true });
    await resetCanonicalAuthority(storage.graphPath);
    await stageAndSwapProjection(
      storage.rootDirectory,
      storage.statePath,
      `${JSON.stringify(initialState(environment), null, 2)}\n`,
    );
    await stageAndSwapProjection(
      storage.rootDirectory,
      storage.indexPath,
      renderIndex({ nodes: [], edges: [] }),
    );
  });

  io.stdout.write(
    `${JSON.stringify({
      mode: environment.active ? "gsd" : "standalone",
      storage_root: toRootRelative(root, storage.rootDirectory),
      files: [...MANAGED_FILES],
      ...(force ? { force } : {}),
    })}\n`,
  );
  return 0;
}
