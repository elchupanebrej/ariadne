import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { EpistemicGateEngine } from "../../gates/gate-engine.js";
import { isFrontierNode, renderCard } from "../../graph/domain.js";
import type { GraphBatch } from "../../graph/epistemic-graph.js";
import { buildMergeCheckReceipt } from "./merge-check.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import {
  parseOptions,
  parseOutputFormat,
  syntaxError,
  writeDomainDiagnostic,
} from "../contract.js";

const runFile = promisify(execFile);
const USAGE = "Usage: ariadne merge-sync [--format json] [--stage-derived]\n";

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
  batch: GraphBatch,
  ids: Set<string>,
  cardsDirectory: string,
): Promise<string[]> => {
  const removed: string[] = [];
  for (const id of await batch.listCards()) {
    if (ids.has(id)) continue;
    batch.deleteCard(id);
    removed.push(join(cardsDirectory, `${id}.md`));
  }
  return removed;
};

const existingCards = async (
  batch: GraphBatch,
  ids: readonly string[],
): Promise<Map<string, string>> => {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const content = await batch.readCard(id);
      return content === undefined ? undefined : ([id, content] as const);
    }),
  );
  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== undefined));
};

const withoutRevisionDate = (content: string): string =>
  content.replace(/^- Revised: \d{4}-\d{2}-\d{2}$/mu, "- Revised: <derived>");

const preserveStableCards = (
  batch: GraphBatch,
  previous: ReadonlyMap<string, string>,
  ids: readonly string[],
): void => {
  const nodes = new Map(batch.graph.nodes.map((node) => [node.id, node]));
  const restores = ids.flatMap((id) => {
    const before = previous.get(id);
    const node = nodes.get(id);
    if (before === undefined || node === undefined) return [];
    const regenerated = renderCard(node);
    if (regenerated === before) return [];
    return withoutRevisionDate(regenerated) === withoutRevisionDate(before)
      ? [{ id, content: before }]
      : [];
  });
  if (restores.length > 0) batch.writeCards(restores);
};

type JsonProperty = {
  key: string;
  valueStart: number;
  valueEnd: number;
};

type JsonObjectLayout = {
  openingEnd: number;
  closingStart: number;
  properties: JsonProperty[];
};

const isJsonWhitespace = (value: string | undefined): boolean =>
  value === " " || value === "\n" || value === "\r" || value === "\t";

const skipJsonWhitespace = (content: string, start: number): number => {
  let cursor = start;
  while (isJsonWhitespace(content[cursor])) cursor += 1;
  return cursor;
};

const scanJsonStringEnd = (content: string, start: number): number => {
  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
    if (content[cursor] === "\\") {
      cursor += 1;
    } else if (content[cursor] === '"') {
      return cursor + 1;
    }
  }
  throw new Error("Invalid JSON string in STATE.yaml");
};

const scanJsonValueEnd = (content: string, start: number): number => {
  const opening = content[start];
  if (opening === '"') return scanJsonStringEnd(content, start);
  if (opening !== "{" && opening !== "[") {
    let end = start;
    while (end < content.length && !",}".includes(content[end])) end += 1;
    while (end > start && isJsonWhitespace(content[end - 1])) end -= 1;
    return end;
  }

  const closings = new Map([
    ["{", "}"],
    ["[", "]"],
  ]);
  const stack = [closings.get(opening) as string];
  for (let cursor = start + 1; cursor < content.length; cursor += 1) {
    const value = content[cursor];
    if (value === '"') {
      cursor = scanJsonStringEnd(content, cursor) - 1;
      continue;
    }
    if (closings.has(value)) {
      stack.push(closings.get(value) as string);
      continue;
    }
    if (value === stack.at(-1)) {
      stack.pop();
      if (stack.length === 0) return cursor + 1;
    }
  }
  throw new Error("Invalid JSON value in STATE.yaml");
};

const scanJsonObject = (content: string): JsonObjectLayout => {
  const opening = skipJsonWhitespace(content, 0);
  if (content[opening] !== "{") throw new Error("STATE.yaml must contain a JSON object");

  const properties: JsonProperty[] = [];
  let cursor = opening + 1;
  while (true) {
    cursor = skipJsonWhitespace(content, cursor);
    if (content[cursor] === "}") {
      return { openingEnd: opening + 1, closingStart: cursor, properties };
    }
    const keyStart = cursor;
    const keyEnd = scanJsonStringEnd(content, keyStart);
    const key = JSON.parse(content.slice(keyStart, keyEnd)) as string;
    cursor = skipJsonWhitespace(content, keyEnd);
    if (content[cursor] !== ":") throw new Error("Invalid STATE.yaml object");
    const valueStart = skipJsonWhitespace(content, cursor + 1);
    const valueEnd = scanJsonValueEnd(content, valueStart);
    properties.push({ key, valueStart, valueEnd });
    cursor = skipJsonWhitespace(content, valueEnd);
    if (content[cursor] === ",") {
      cursor += 1;
      continue;
    }
    if (content[cursor] !== "}") throw new Error("Invalid STATE.yaml object");
    return { openingEnd: opening + 1, closingStart: cursor, properties };
  }
};

const fieldIndent = (content: string, property: JsonProperty): string => {
  const lineStart = content.lastIndexOf("\n", property.valueStart - 1) + 1;
  const prefix = content.slice(lineStart, property.valueStart);
  return prefix.match(/^[ \t]*/u)?.[0] || "  ";
};

const missingJsonFields = (
  content: string,
  layout: JsonObjectLayout,
  fields: ReadonlyMap<string, unknown>,
): string => {
  const lastValueEnd = layout.properties.at(-1)?.valueEnd ?? layout.openingEnd;
  const trailing = content.slice(lastValueEnd, layout.closingStart);
  const multiline = trailing.includes("\n");
  const lineBreak = content.includes("\r\n") ? "\r\n" : "\n";
  const indent = multiline
    ? layout.properties[0]
      ? fieldIndent(content, layout.properties[0])
      : "  "
    : "";
  const rendered = [...fields]
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(multiline ? `,${lineBreak}${indent}` : ", ");
  if (layout.properties.length === 0) {
    return multiline ? `${lineBreak}${indent}${rendered}` : rendered;
  }
  return multiline ? `,${lineBreak}${indent}${rendered}` : `, ${rendered}`;
};

const patchStateJson = (
  content: string,
  state: Record<string, unknown>,
  projections: Readonly<Record<string, readonly string[]>>,
): string => {
  const layout = scanJsonObject(content);
  const properties = new Map(layout.properties.map((property) => [property.key, property]));
  const replacements = new Map<string, string>();
  const missing = new Map<string, unknown>();
  for (const [key, value] of Object.entries(projections)) {
    const serialized = JSON.stringify(value);
    const property = properties.get(key);
    if (!property) {
      missing.set(key, value);
    } else if (JSON.stringify(state[key]) !== serialized) {
      replacements.set(key, serialized);
    }
  }

  const insertionPoint =
    missing.size > 0
      ? layout.properties.at(-1)?.valueEnd ?? layout.openingEnd
      : undefined;
  const insertion =
    insertionPoint === undefined
      ? undefined
      : missingJsonFields(content, layout, missing);
  let result = "";
  let cursor = 0;
  for (const property of layout.properties) {
    result += content.slice(cursor, property.valueStart);
    result += replacements.get(property.key) ?? content.slice(property.valueStart, property.valueEnd);
    cursor = property.valueEnd;
    if (cursor === insertionPoint) result += insertion;
  }
  if (layout.properties.length === 0 && insertionPoint === layout.openingEnd) {
    result += content.slice(cursor, insertionPoint);
    result += insertion;
    cursor = insertionPoint;
  }
  result += content.slice(cursor);
  return result;
};

const syncState = async (
  batch: GraphBatch,
  storageRoot: string,
): Promise<{ path: string; changed: boolean }> => {
  const state = (await batch.readState()) ?? {};
  const graph = batch.graph;
  const frontier = graph.nodes.filter(isFrontierNode).map(({ id }) => id);
  const openUnknowns = graph.nodes
    .filter((node) => isFrontierNode(node) && node.type === "UNK")
    .map(({ id }) => id);
  const projections: Record<string, readonly string[]> = {
    frontier,
    open_unknowns: openUnknowns,
  };
  if ("active_frontier" in state) projections.active_frontier = frontier;
  if ("openUnknowns" in state) projections.openUnknowns = openUnknowns;
  if ("unknowns" in state) projections.unknowns = openUnknowns;
  const statePath = join(storageRoot, "STATE.yaml");
  let previous: string | undefined;
  try {
    previous = await readFile(statePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const next = { ...state, ...projections };
  const serialized = previous
    ? patchStateJson(previous, state, projections)
    : `${JSON.stringify(next, null, 2)}\n`;
  const changed = previous !== serialized;
  if (changed) {
    batch.writeStateProjection(serialized);
  }
  return { path: statePath, changed };
};

const stageDerived = async (
  root: string,
  storageRoot: string,
  cardPaths: readonly string[],
): Promise<string[]> => {
  const indexPath = join(storageRoot, "INDEX.md");
  const statePath = join(storageRoot, "STATE.yaml");
  const cardsDirectory = join(storageRoot, "cards");
  const relativeIndexPath = relativePath(root, indexPath);
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
  const relativeStatePath = relativePath(root, statePath);
  const stagedState = (
    await runFile(
      "git",
      ["-C", root, "diff", "--cached", "--name-only", "--", relativeStatePath],
      {
        encoding: "utf8",
      },
    )
  ).stdout.trim();
  if (stagedState) await runFile("git", ["-C", root, "reset", "--", relativeStatePath]);
  return [
    relativeIndexPath,
    ...((await exists(cardsDirectory))
      ? [relativePath(root, cardsDirectory)]
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
  const output = parseOutputFormat(args, ["json"], "human", USAGE.trim());
  const legacyJson = output.rest.filter((arg) => arg === "--json");
  if (legacyJson.length > 1 || (legacyJson.length === 1 && output.format === "json")) {
    throw syntaxError("Specify only one JSON output option.");
  }
  const parsed = parseOptions(
    output.rest.filter((arg) => arg !== "--json"),
    [{ name: "stage-derived" }],
    USAGE.trim(),
  );
  if (parsed.positionals.length > 0) {
    throw syntaxError(USAGE.trim());
  }
  const json = output.format === "json" || legacyJson.length === 1;
  const shouldStageDerived = parsed.flags.has("stage-derived");

  const { environment, graph: engine } = await resolveCliWorkspace(io);
  const graph = await engine.materialize();
  const validation = EpistemicGateEngine.verify(graph, {
    gate: "all",
    strict: true,
  });
  const mergeCheck = buildMergeCheckReceipt(
    environment.rootPath,
    environment.storageRoot,
    graph,
  );
  const cardsDirectory = join(environment.storageRoot, "cards");
  const ids = graph.nodes.map(({ id }) => id);
  let removedCards: string[] = [];
  let state: { path: string; changed: boolean } = {
    path: join(environment.storageRoot, "STATE.yaml"),
    changed: false,
  };
  await engine.batch(async (batch) => {
    const previousCards = await existingCards(batch, ids);
    removedCards = await removeStaleCards(batch, new Set(ids), cardsDirectory);
    batch.regenerateIndex();
    preserveStableCards(batch, previousCards, ids);
    state = await syncState(batch, environment.storageRoot);
  });
  const staged = shouldStageDerived
    ? await stageDerived(
        environment.rootPath,
        environment.storageRoot,
        [
          ...removedCards,
          ...ids.map((id) => join(cardsDirectory, `${id}.md`)),
        ],
      )
    : [];
  const receipt = {
    command: "merge-sync" as const,
    passed: validation.passed,
    graph_path: relativePath(
      environment.rootPath,
      join(environment.storageRoot, "GRAPH.jsonl"),
    ),
    generated: {
      index: relativePath(
        environment.rootPath,
        join(environment.storageRoot, "INDEX.md"),
      ),
      cards: relativePath(environment.rootPath, cardsDirectory),
      state: relativePath(environment.rootPath, state.path),
    },
    state_changed: state.changed,
    staged,
    validation,
    publication: mergeCheck,
  };
  if (json) {
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
  if (!validation.passed) {
    writeDomainDiagnostic(
      io,
      json ? "json" : "human",
      "GATE_FAILED",
      "Ariadne merge synchronization completed with failed validation.",
      { gate: "all", diagnostics: validation.diagnostics },
    );
  }
  return validation.passed ? 0 : 1;
}

export { USAGE as MERGE_SYNC_USAGE };
