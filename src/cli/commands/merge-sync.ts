import { execFile } from "node:child_process";
import { access, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
): Promise<string[]> => {
  if (!(await exists(storage.cardsDirectory))) return [];
  const removed: string[] = [];
  for (const entry of await readdir(storage.cardsDirectory, {
    withFileTypes: true,
  })) {
    if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      !ids.has(entry.name.slice(0, -3))
    ) {
      const path = join(storage.cardsDirectory, entry.name);
      await rm(path);
      removed.push(path);
    }
  }
  return removed;
};

const existingCards = async (
  storage: GraphStorage,
  ids: readonly string[],
): Promise<Map<string, string>> => {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const path = join(storage.cardsDirectory, `${id}.md`);
      try {
        return [path, await readFile(path, "utf8")] as const;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== undefined));
};

const withoutRevisionDate = (content: string): string =>
  content.replace(/^- Revised: \d{4}-\d{2}-\d{2}$/mu, "- Revised: <derived>");

const preserveStableCards = async (
  storage: GraphStorage,
  previous: ReadonlyMap<string, string>,
  ids: readonly string[],
): Promise<void> => {
  await Promise.all(
    ids.map(async (id) => {
      const path = join(storage.cardsDirectory, `${id}.md`);
      const before = previous.get(path);
      if (before === undefined) return;
      const after = await readFile(path, "utf8");
      if (after !== before && withoutRevisionDate(after) === withoutRevisionDate(before)) {
        await writeFile(path, before, "utf8");
      }
    }),
  );
};

const syncState = async (
  storage: GraphStorage,
  graph: Awaited<ReturnType<GraphStorage["materialize"]>>,
): Promise<{ path: string; changed: boolean }> => {
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
  let previous: string | undefined;
  try {
    previous = await readFile(storage.statePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const changed = previous !== serialized;
  if (changed) await storage.writeState(next);
  return { path: storage.statePath, changed };
};

const stageDerived = async (
  root: string,
  storage: GraphStorage,
  cardPaths: readonly string[],
): Promise<string[]> => {
  const relativeIndexPath = relativePath(root, storage.indexPath);
  const relativeCardPaths = (
    await Promise.all(
      [...new Set(cardPaths)].map(async (path) => {
        const relativeCardPath = relativePath(root, path);
        if (await exists(path)) return relativeCardPath;
        const tracked = (
          await runFile(
            "git",
            ["-C", root, "ls-files", "--", relativeCardPath],
            { encoding: "utf8" },
          )
        ).stdout.trim();
        return tracked ? relativeCardPath : undefined;
      }),
    )
  ).filter((path): path is string => path !== undefined);
  await runFile("git", [
    "-C",
    root,
    "add",
    "--",
    relativeIndexPath,
    ...relativeCardPaths,
  ]);
  const statePath = relativePath(root, storage.statePath);
  const stagedState = (
    await runFile(
      "git",
      ["-C", root, "diff", "--cached", "--name-only", "--", statePath],
      {
        encoding: "utf8",
      },
    )
  ).stdout.trim();
  if (stagedState) await runFile("git", ["-C", root, "reset", "--", statePath]);
  return [
    relativeIndexPath,
    ...((await exists(storage.cardsDirectory))
      ? [relativePath(root, storage.cardsDirectory)]
      : []),
  ];
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
  const previousCards = await existingCards(
    storage,
    graph.nodes.map(({ id }) => id),
  );
  const validation = EpistemicGateEngine.verify(graph, {
    gate: "all",
    strict: true,
  });
  const mergeCheck = buildMergeCheckReceipt(
    environment.rootPath,
    environment.storageRoot,
    graph,
  );
  const removedCards = await removeStaleCards(
    storage,
    new Set(graph.nodes.map(({ id }) => id)),
  );
  await storage.regenerateIndex();
  await preserveStableCards(
    storage,
    previousCards,
    graph.nodes.map(({ id }) => id),
  );
  const state = await syncState(storage, graph);
  const staged = args.includes("--stage-derived")
    ? await stageDerived(
        environment.rootPath,
        storage,
        [
          ...removedCards,
          ...graph.nodes.map(({ id }) => join(storage.cardsDirectory, `${id}.md`)),
        ],
      )
    : [];
  const receipt = {
    command: "merge-sync" as const,
    passed: validation.passed,
    graph_path: relativePath(environment.rootPath, storage.graphPath),
    generated: {
      index: relativePath(environment.rootPath, storage.indexPath),
      cards: relativePath(environment.rootPath, storage.cardsDirectory),
      state: relativePath(environment.rootPath, state.path),
    },
    state_changed: state.changed,
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
        `State projection ${state.changed ? "changed" : "unchanged"} in working tree only: ${receipt.generated.state}`,
        ...(staged.length > 0
          ? [`Staged derived files: ${staged.join(", ")}`]
          : []),
        ...mergeCheck.diagnostics.map(
          ({ nodeId, card, guidance }) =>
            `Merge conflict: [${nodeId}](${card}) — ${guidance}`,
        ),
        "",
      ].join("\n"),
    );
  }
  return validation.passed ? 0 : 1;
}

export { USAGE as MERGE_SYNC_USAGE };
