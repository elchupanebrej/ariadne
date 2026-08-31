import { execFile } from "node:child_process";
import { access, readdir, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { EpistemicGateEngine } from "../../gates/gate-engine.js";
import { isFrontierNode, GraphStorage } from "../../graph/storage.js";
import { buildMergeCheckReceipt } from "./merge-check.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

const runFile = promisify(execFile);
const USAGE = "Usage: ariadne merge-sync [--json] [--stage-derived]\n";

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const relativePath = (root: string, path: string): string =>
  relative(root, path).replaceAll("\\", "/");

const removeStaleCards = async (
  storage: GraphStorage,
  ids: Set<string>,
): Promise<void> => {
  if (!(await exists(storage.cardsDirectory))) return;
  for (const entry of await readdir(storage.cardsDirectory, {
    withFileTypes: true,
  })) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      !ids.has(entry.name.slice(0, -3))
    ) {
      await rm(join(storage.cardsDirectory, entry.name));
    }
  }
};

const syncState = async (
  storage: GraphStorage,
  graph: Awaited<ReturnType<GraphStorage["materialize"]>>,
): Promise<string> => {
  const state = (await storage.readState<Record<string, unknown>>()) ?? {};
  const frontier = graph.nodes.filter(isFrontierNode).map(({ id }) => id);
  const openUnknowns = graph.nodes
    .filter((node) => isFrontierNode(node) && node.type === "UNK")
    .map(({ id }) => id);
  const next: Record<string, unknown> = {
    ...state,
    frontier,
    open_unknowns: openUnknowns,
  };
  if ("active_frontier" in state) next.active_frontier = frontier;
  if ("openUnknowns" in state) next.openUnknowns = openUnknowns;
  if ("unknowns" in state) next.unknowns = openUnknowns;
  await storage.writeState(next);
  return storage.statePath;
};

const stageDerived = async (
  root: string,
  storage: GraphStorage,
): Promise<string[]> => {
  const paths = [
    storage.indexPath,
    ...((await exists(storage.cardsDirectory)) ? [storage.cardsDirectory] : []),
  ];
  const relativePaths = paths.map((path) => relativePath(root, path));
  if (relativePaths.length > 0)
    await runFile("git", ["-C", root, "add", "--", ...relativePaths]);
  return relativePaths;
};

export async function runMergeSync(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(USAGE);
    return 0;
  }
  if (args.some((arg) => arg !== "--json" && arg !== "--stage-derived")) {
    throw new Error(USAGE.trim());
  }

  const { environment } = await resolveCliWorkspace(io);
  const storage = new GraphStorage(environment.storageRoot);
  const graph = await storage.materialize();
  const validation = EpistemicGateEngine.verify(graph, {
    gate: "all",
    strict: true,
  });
  const mergeCheck = buildMergeCheckReceipt(
    environment.rootPath,
    environment.storageRoot,
    graph,
  );
  await removeStaleCards(storage, new Set(graph.nodes.map(({ id }) => id)));
  await storage.regenerateIndex();
  const statePath = await syncState(storage, graph);
  const staged = args.includes("--stage-derived")
    ? await stageDerived(environment.rootPath, storage)
    : [];
  const receipt = {
    command: "merge-sync" as const,
    passed: validation.passed,
    graph_path: relativePath(environment.rootPath, storage.graphPath),
    generated: {
      index: relativePath(environment.rootPath, storage.indexPath),
      cards: relativePath(environment.rootPath, storage.cardsDirectory),
      state: relativePath(environment.rootPath, statePath),
    },
    staged,
    validation,
    publication: mergeCheck,
  };
  if (args.includes("--json")) {
    io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } else {
    io.stdout.write(
      [
        `Ariadne merge sync: ${validation.passed ? "validated" : "validation failed"}`,
        `Generated: ${receipt.generated.index}, ${receipt.generated.cards}`,
        `State projection updated in working tree only: ${receipt.generated.state}`,
        ...(staged.length > 0
          ? [`Staged derived files: ${staged.join(", ")}`]
          : []),
        ...mergeCheck.diagnostics.map(
          ({ nodeId, card }) => `Merge conflict: ${nodeId} — ${card}`,
        ),
        "",
      ].join("\n"),
    );
  }
  return validation.passed ? 0 : 1;
}

export { USAGE as MERGE_SYNC_USAGE };
