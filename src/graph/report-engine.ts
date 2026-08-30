import { readdir } from "node:fs/promises";
import type { EpistemicEdge } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";
import { toRootRelative } from "../core/root-relative.js";
import type { GraphEvent } from "./storage.js";
import {
  childEdges,
  computeForest,
  fold,
  reachableCount,
  type FoldedGraph,
} from "./traversal.js";

const WIDTH = 100; // every printed line stays inside this budget (CTR-RPT-01)
const ANCHOR_AT = 24;
export const LOG_TYPES = new Set(["CAN", "DEC", "EVD", "UNK"]);
export const TOMBSTONE_STATUSES = new Set(["REMOVED", "INVALIDATED"]);

const trunc = (value: unknown, max: number): string => {
  const oneLine = String(value ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
};

const firstSentence = (value: string | undefined): string =>
  trunc(value?.split(/(?<=\.)\s/)[0], WIDTH);

type ExtraFields = {
  resolved_by?: string;
  verdict?: string;
};

export const answerText = (node: Node): string => {
  const fields = node as unknown as ExtraFields;
  if (node.type === "UNK") {
    return fields.resolved_by ? `resolved by ${fields.resolved_by}` : "UNRESOLVED";
  }
  if (node.type === "EVD") {
    return fields.verdict ? `verdict: ${trunc(fields.verdict, 40)}` : firstSentence(node.statement);
  }
  return firstSentence(node.statement);
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

export interface ReportOptions {
  cardsPrefix?: string;
  graphPath?: string;
  rootId?: string;
}

export function buildReport(
  events: readonly GraphEvent[],
  options: ReportOptions = {},
): ReportOutput {
  const cardsPrefix = options.cardsPrefix ?? ".ariadne/cards";
  const graphPath = options.graphPath;
  const rootId = options.rootId;
  const graph = fold(events);
  const { nodes } = graph;

  const childEdgesOf = (id: string): EpistemicEdge[] => childEdges(graph, id);

  const out: string[] = [];
  out.push("ARIADNE DECISION-TREE REPORT");
  out.push(`graph: ${graphPath ?? "-"} | nodes: ${nodes.size} | edges: ${graph.edges.length}`);
  out.push("edges read X --> Y: X depends on / derives from Y");
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
    const kids = childEdgesOf(id);
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
    const kids = childEdgesOf(blockId);
    kids.forEach((edge, index) =>
      emit(state, edge.source, "", edge.type, index === kids.length - 1),
    );
  };

  const emitRoot = (rootIdToEmit: string, filterKids?: Set<string>): void => {
    const rootNode = nodes.get(rootIdToEmit);
    if (!rootNode) throw new Error(`Unknown FRAME: ${rootIdToEmit}`);
    const state: SectionState = { seen: new Set([rootIdToEmit]), deferred: [] };
    const status = rootNode.status ?? "ACTIVE";
    out.push(
      `${rootIdToEmit} [${status}] ${trunc(rootNode.title, WIDTH - rootIdToEmit.length - status.length - 4)}`,
    );
    out.push(`~ ${trunc(answerText(rootNode), WIDTH - 2)}`);
    const kids = childEdgesOf(rootIdToEmit).filter((edge) => !filterKids || filterKids.has(edge.source));
    kids.forEach((edge, index) =>
      emit(state, edge.source, "", edge.type, index === kids.length - 1),
    );
    let entry = state.deferred.shift();
    while (entry) {
      renderRootBlock(state, entry.id, entry.label);
      entry = state.deferred.shift();
    }
  };

  const sections: ReportSummary["sections"] = [];
  let remainderRoots: string[] = [];

  const renderTreeSection = (sectionRoot: string): void => {
    out.push(
      `== TREE ${sections.length + 1}: ${sectionRoot} (${reachableCount(graph, sectionRoot)} nodes reachable) ==`,
    );
    emitRoot(sectionRoot);
    sections.push({ root: sectionRoot, reachable: reachableCount(graph, sectionRoot) });
    out.push("");
  };

  if (rootId !== undefined) {
    const node = nodes.get(rootId);
    if (!node || node.type !== "FRAME") throw new Error(`Unknown FRAME: ${rootId}`);
    renderTreeSection(rootId);
  } else {
    const forest = computeForest(graph);
    for (const section of forest.sections) renderTreeSection(section.root);

    if (forest.remainderNodes.size > 0) {
      remainderRoots = forest.remainderRoots;
      out.push(
        `== REMAINDER: ${forest.remainderNodes.size} nodes outside FRAME-rooted trees (${remainderRoots.length} local roots) ==`,
      );
      for (const sectionRoot of remainderRoots) {
        emitRoot(sectionRoot, forest.remainderNodes);
        out.push("");
      }
    }
  }

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

export const slugify = (frameId: string): string =>
  frameId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function nextReportOrdinal(reportsDirectory: string): Promise<string> {
  let highestNumber = 0;
  for (const entry of await readdir(reportsDirectory)) {
    const match = /^(\d+)-/.exec(entry);
    if (match) highestNumber = Math.max(highestNumber, Number(match[1]));
  }
  return String(highestNumber + 1).padStart(3, "0");
}
