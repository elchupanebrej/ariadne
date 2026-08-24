import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { EpistemicEdge } from "../../core/schemas/edges.js";
import type { Node } from "../../core/schemas/nodes.js";
import type { GraphEvent } from "../../graph/storage.js";
import { hasHelp, resolveCliWorkspace, type CliIO } from "../workspace.js";

const WIDTH = 100; // every printed line stays inside this budget (CTR-RPT-01)
// ponytail: prefixes past ANCHOR_AT overflow WIDTH by fixed-part length on
// very deep chains; upgrade path is line-wrapping the head.
const ANCHOR_AT = 24;
const LOG_TYPES = new Set(["CAN", "DEC", "EVD", "UNK"]);
const TOMBSTONE_STATUSES = new Set(["REMOVED", "INVALIDATED"]);

const trunc = (value: unknown, max: number): string => {
  // Live-graph passthrough fields may be arrays/objects; mirror the prototype's
  // String() coercion so renders stay deterministic.
  const oneLine = String(value ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
};

const firstSentence = (value: string | undefined): string =>
  trunc(value?.split(/(?<=\.)\s/)[0], WIDTH);

type ExtraFields = {
  resolved_by?: string;
  verdict?: string;
};

// DEC-RPT-07: intermediate answer derived from the existing node payload.
const answerText = (node: Node): string => {
  const fields = node as unknown as ExtraFields;
  if (node.type === "UNK") {
    return fields.resolved_by ? `resolved by ${fields.resolved_by}` : "UNRESOLVED";
  }
  if (node.type === "EVD") {
    return fields.verdict ? `verdict: ${trunc(fields.verdict, 40)}` : firstSentence(node.statement);
  }
  return firstSentence(node.statement);
};

type FoldedGraph = {
  nodes: Map<string, Node>;
  edges: EpistemicEdge[];
  childrenOf: Map<string, EpistemicEdge[]>;
};

// Append-only fold: latest append per node id wins; edges dedup on the triple.
const fold = (events: readonly GraphEvent[]): FoldedGraph => {
  const nodes = new Map<string, Node>();
  const edgeKeys = new Set<string>();
  const edges: EpistemicEdge[] = [];
  for (const event of events) {
    if (event.kind === "node") {
      nodes.set(event.node.id, event.node);
    } else {
      const key = `${event.edge.source}\u0000${event.edge.type}\u0000${event.edge.target}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push(event.edge);
      }
    }
  }
  // Live-graph orientation: every edge reads "source depends on / derives from /
  // is answered by target", so source is downstream of target. Children(X) =
  // sources of edges targeting X. A root is a node that never appears as a
  // source. This refines DEC-RPT-08's literal "no incoming edges" wording.
  const childrenOf = new Map<string, EpistemicEdge[]>();
  for (const edge of edges) {
    const group = childrenOf.get(edge.target);
    if (group) group.push(edge);
    else childrenOf.set(edge.target, [edge]);
  }
  return { nodes, edges, childrenOf };
};

export type ReportSummary = {
  mode: "forest" | "tree";
  sections: { root: string; reachable: number }[];
  remainder_roots: string[];
  change_log: { shown: number; appends: number };
};

export type ReportOutput = {
  text: string;
  summary: ReportSummary;
};

export function buildReport(
  events: readonly GraphEvent[],
  options: { cardsPrefix: string; graphPath?: string; rootId?: string },
): ReportOutput {
  const { cardsPrefix, graphPath, rootId } = options;
  const graph = fold(events);
  const { nodes } = graph;

  const childEdges = (id: string): EpistemicEdge[] =>
    (graph.childrenOf.get(id) ?? []).slice().sort((left, right) => left.source.localeCompare(right.source));

  const out: string[] = [];
  out.push("ARIADNE DECISION-TREE REPORT");
  out.push(`graph: ${graphPath ?? "-"} | nodes: ${nodes.size} | edges: ${graph.edges.length}`);
  out.push("");

  type Deferred = { id: string; label: string };
  type SectionState = { seen: Set<string>; deferred: Deferred[] };

  const emit = (
    state: SectionState,
    id: string,
    prefix: string,
    label: string,
    isLast: boolean,
  ): void => {
    const branch = `${isLast ? "`-- " : "|-- "}${label} --> `;
    const node = nodes.get(id);
    if (!node) {
      out.push(`${prefix}${branch}${id} [missing]`);
      return;
    }
    if (state.seen.has(id)) {
      out.push(`${prefix}${branch}${id} (rendered above)`.trimEnd());
      return;
    }
    state.seen.add(id);
    const status = node.status ?? "ACTIVE";
    const head = `${prefix}${branch}${id} [${status}] `;
    const titleBudget = WIDTH - head.length;
    out.push(titleBudget >= 4 ? `${head}${trunc(node.title, titleBudget)}` : head.trimEnd());
    const continuation = prefix + (isLast ? "     " : "|    ");
    const anchorWidth = Math.min(continuation.length, ANCHOR_AT + 1);
    out.push(
      `${continuation.slice(0, anchorWidth)}~ ${trunc(answerText(node), WIDTH - anchorWidth - 2)}`,
    );
    const kids = childEdges(id);
    kids.forEach((edge, index) => {
      const last = index === kids.length - 1;
      if (continuation.length > ANCHOR_AT && !state.seen.has(edge.source)) {
        out.push(`${continuation}${last ? "`" : "|"}`.trimEnd() + "-- ...");
        state.deferred.push({ id: edge.source, label: edge.type });
        state.seen.add(edge.source);
      } else {
        emit(state, edge.source, continuation, edge.type, last);
      }
    });
  };

  // One full render per node per section; repeats become one-line stubs. A
  // back-edge always lands in `seen` (deductive cycles cannot exist per
  // 00-core: a cycle must be a CTR node), so traversal terminates there.
  const renderRootBlock = (state: SectionState, blockId: string, label: string): void => {
    const blockNode = nodes.get(blockId);
    out.push(`-- subtree continued: ${label} --> ${blockId} --`);
    if (!blockNode) {
      out.push(`${blockId} [missing]`);
      return;
    }
    const status = blockNode.status ?? "ACTIVE";
    out.push(
      `${blockId} [${status}] ${trunc(blockNode.title, WIDTH - blockId.length - status.length - 4)}`,
    );
    out.push(`~ ${trunc(answerText(blockNode), WIDTH - 2)}`);
    const kids = childEdges(blockId);
    kids.forEach((edge, index) =>
      emit(state, edge.source, "", edge.type, index === kids.length - 1),
    );
  };

  const reachableCount = (rootId: string): number => {
    const probe = new Set([rootId]);
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      for (const edge of childEdges(id)) {
        if (!probe.has(edge.source)) {
          probe.add(edge.source);
          stack.push(edge.source);
        }
      }
    }
    return probe.size;
  };

  // Drain subtrees that outgrew the inline prefix as fresh column-0 blocks.
  // Below a section root the walk follows ALL edges (the prototype contract):
  // only a remainder root's direct children are restricted to the remainder set.
  const emitRoot = (rootId: string, filterKids?: Set<string>): void => {
    const rootNode = nodes.get(rootId);
    if (!rootNode) throw new Error(`Unknown FRAME: ${rootId}`);
    const state: SectionState = { seen: new Set([rootId]), deferred: [] };
    const status = rootNode.status ?? "ACTIVE";
    out.push(
      `${rootId} [${status}] ${trunc(rootNode.title, WIDTH - rootId.length - status.length - 4)}`,
    );
    out.push(`~ ${trunc(answerText(rootNode), WIDTH - 2)}`);
    const kids = childEdges(rootId).filter((edge) => !filterKids || filterKids.has(edge.source));
    kids.forEach((edge, index) =>
      emit(state, edge.source, "", edge.type, index === kids.length - 1),
    );
    let entry = state.deferred.shift();
    while (entry) {
      renderRootBlock(state, entry.id, entry.label);
      entry = state.deferred.shift();
    }
    for (const id of state.seen) covered.add(id);
  };

  const covered = new Set<string>();
  const sections: ReportSummary["sections"] = [];
  let remainderRoots: string[] = [];

  const renderTreeSection = (sectionRoot: string, filterKids?: Set<string>): void => {
    out.push(
      `== TREE ${sections.length + 1}: ${sectionRoot} (${reachableCount(sectionRoot)} nodes reachable) ==`,
    );
    emitRoot(sectionRoot, filterKids);
    sections.push({ root: sectionRoot, reachable: reachableCount(sectionRoot) });
    out.push("");
  };

  if (rootId !== undefined) {
    const node = nodes.get(rootId);
    if (!node || node.type !== "FRAME") throw new Error(`Unknown FRAME: ${rootId}`);
    renderTreeSection(rootId);
  } else {
    // DEC-RPT-08 forest default: one full subtree (DEC-RPT-03) per FRAME root.
    const sources = new Set(graph.edges.map((edge) => edge.source));
    const frameRoots = [...nodes.values()]
      .filter((node) => node.type === "FRAME" && !sources.has(node.id))
      .map((node) => node.id)
      .sort();
    for (const sectionRoot of frameRoots) renderTreeSection(sectionRoot);

    // Remainder: nodes whose ancestry does not lead back to a FRAME-rooted tree.
    const remainder = [...nodes.keys()].filter((id) => !covered.has(id));
    if (remainder.length > 0) {
      const remainderSet = new Set(remainder);
      const internalSources = new Set(
        graph.edges
          .filter((edge) => remainderSet.has(edge.source) && remainderSet.has(edge.target))
          .map((edge) => edge.source),
      );
      remainderRoots = remainder.filter((id) => !internalSources.has(id)).sort();
      out.push(
        `== REMAINDER: ${remainder.length} nodes outside FRAME-rooted trees (${remainderRoots.length} local roots) ==`,
      );
      for (const sectionRoot of remainderRoots) {
        emitRoot(sectionRoot, remainderSet);
        out.push("");
      }
    }
  }

  // Change log (DEC-RPT-04): decisive-type appends plus tombstone flips, file order.
  let shown = 0;
  let appends = 0;
  const logLines: string[] = [];
  events.forEach((event, index) => {
    if (event.kind !== "node") return;
    appends += 1;
    const node = event.node;
    const decisive = LOG_TYPES.has(node.type);
    const tombstone = TOMBSTONE_STATUSES.has(String(node.status));
    if (!decisive && !tombstone) return;
    shown += 1;
    logLines.push(
      `[${String(index).padStart(3)}] ${decisive ? "append" : "TOMBSTONE"} ${node.id} -> ${node.status ?? "-"}`,
    );
    logLines.push(`       ${cardsPrefix}/${node.id}.md`);
    const critique = (node as unknown as { adversarial_critique?: string }).adversarial_critique;
    logLines.push(`       ${trunc(critique || node.statement, WIDTH - 7)}`);
  });

  out.push(
    `== CHANGE LOG (filter: appends of CAN/DEC/EVD/UNK + tombstones; ${shown} of ${appends} appends shown) ==`,
  );
  out.push(...logLines);

  return {
    text: `${out.join("\n")}\n`,
    summary: {
      mode: rootId === undefined ? "forest" : "tree",
      sections,
      remainder_roots: remainderRoots,
      change_log: { shown, appends },
    },
  };
}

// DEC-RPT-11: slug built from the root FRAME id, e.g. 001-frame-login-retry.md.
const slugify = (frameId: string): string =>
  frameId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const REPORT_USAGE = "Usage: ariadne report [FRAME-id] [--json]\n";

const toRepoRelative = (from: string, to: string): string =>
  relative(from, to).replaceAll("\\", "/");

export async function runReport(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(REPORT_USAGE);
    return 0;
  }
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  if (positional.length > 1) throw new Error(REPORT_USAGE.trim());
  const [frameArg] = positional;

  const { environment, storage } = await resolveCliWorkspace(io);
  const report = buildReport(await storage.readEvents(), {
    cardsPrefix: toRepoRelative(environment.rootPath, storage.cardsDirectory),
    graphPath: toRepoRelative(environment.rootPath, storage.graphPath),
    rootId: frameArg,
  });

  // DEC-RPT-05: numbered history under <storage root>/reports (DEC-RPT-12 gsd mirror).
  const reportsDirectory = join(storage.rootDirectory, "reports");
  await mkdir(reportsDirectory, { recursive: true });
  let highestNumber = 0;
  for (const entry of await readdir(reportsDirectory)) {
    const match = /^(\d+)-/.exec(entry);
    if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
  }
  const ordinal = String(highestNumber + 1).padStart(3, "0");
  const slugSource = report.summary.sections[0]?.root ?? frameArg ?? "forest";
  const fileName = `${ordinal}-${slugify(slugSource)}.md`;
  await writeFile(join(reportsDirectory, fileName), report.text, "utf8");

  if (json) {
    io.stdout.write(
      `${JSON.stringify({
        file: `${toRepoRelative(environment.rootPath, reportsDirectory)}/${fileName}`,
        ...report.summary,
      })}\n`,
    );
    return 0;
  }
  io.stdout.write(report.text);
  return 0;
}
