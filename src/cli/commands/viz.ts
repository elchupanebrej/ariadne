import { mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Node } from "../../core/schemas/nodes.js";
import { toRootRelative } from "../../core/root-relative.js";
import type { GraphEvent } from "../../graph/storage.js";
import {
  childEdges,
  computeForest,
  fold,
  reachableCount,
  type FoldedGraph,
} from "../../graph/traversal.js";
import { hasHelp, parseOutputFormat, syntaxError } from "../contract.js";
import { resolveCliWorkspace, type CliIO } from "../workspace.js";
import {
  answerText,
  LOG_TYPES,
  nextReportOrdinal,
  slugify,
  TOMBSTONE_STATUSES,
  type ReportSummary,
} from "../../graph/report-engine.js";


const TERMINAL_STATUSES = new Set([
  "RESOLVED",
  "REJECTED",
  "INVALIDATED",
  "REMOVED",
  "DECIDED",
  "WAIVED",
  "SUPERSEDED",
]);

const TYPE_GROUPS: Record<string, string> = {
  FRAME: "structure",
  OBS: "structure",
  TASK: "structure",
  STATE: "structure",
  HANDOFF: "structure",
  "LEAN-TASK": "structure",
  CLM: "claims",
  ASM: "claims",
  HYP: "claims",
  UNK: "claims",
  CTR: "conflict",
  TRF: "conflict",
  SPACE: "conflict",
  CAN: "mechanism",
  DEP: "mechanism",
  DYN: "mechanism",
  VAL: "mechanism",
  "VAL-SELECT": "mechanism",
  EVDREQ: "evidence",
  EVD: "evidence",
  TRANS: "transition",
  DEC: "decision",
};

const typeGroup = (type: string): string => TYPE_GROUPS[type] ?? "other";

const HELP_DIAGRAMS: Record<string, number> = {
  TASK: 22,
  FRAME: 22,
  CLM: 22,
  OBS: 33,
  HYP: 33,
  CTR: 33,
  TRF: 48,
  SPACE: 60,
  CAN: 60,
  UNK: 80,
  ASM: 80,
  EVDREQ: 80,
  EVD: 80,
  DEP: 94,
  DYN: 108,
  "VAL-SELECT": 126,
  VAL: 136,
  TRANS: 136,
  DEC: 136,
};

const esc = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmt = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(fmt).join("; ");
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
};

const trunc = (value: unknown, max: number): string => {
  const oneLine = fmt(value).replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
};

const isClosedUnknown = (node: Node): boolean => {
  if (TERMINAL_STATUSES.has(String(node.status))) return true;
  const extra = node as unknown as { resolved_by?: string; waived_by?: string };
  return extra.resolved_by !== undefined || extra.waived_by !== undefined;
};

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; margin: 0; padding: 2rem 1.5rem; }
header, section { max-width: 1100px; margin: 0 auto 2rem; }
h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
h2 { font-size: 1rem; margin: 0 0 .75rem; color: #7dd3fc; }
.meta { color: #94a3b8; font-size: .85rem; margin: 0 0 1.25rem; }
.panel { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; }
ul.tree-root, ul.children { list-style: none; padding-left: 1.25rem; margin: .25rem 0; border-left: 1px solid #334155; }
ul.tree-root { border-left: none; padding-left: 0; }
details.node > summary { cursor: pointer; padding: .25rem .4rem; border-radius: 4px; }
details.node > summary:hover { background: #334155; }
summary { list-style-position: inside; }
.badge { display: inline-block; font-family: ui-monospace, ui-monospace, monospace; font-size: .72rem; padding: 1px 6px; border-radius: 4px; margin-right: .4rem; vertical-align: middle; }
.id-badge { background: #0f172a; color: #cbd5e1; border: 1px solid #475569; }
.type-badge { color: #020617; font-weight: 700; }
.tg-structure .type-badge { background: #14b8a6; }
.tg-claims .type-badge { background: #f59e0b; }
.tg-conflict .type-badge { background: #ef4444; }
.tg-mechanism .type-badge { background: #3b82f6; }
.tg-evidence .type-badge { background: #22c55e; }
.tg-transition .type-badge { background: #8b5cf6; }
.tg-decision .type-badge { background: #d946ef; }
.tg-other .type-badge { background: #64748b; }
.prov-chip { font-family: ui-monospace, monospace; font-size: .7rem; padding: 1px 8px; border-radius: 10px; margin-right: .4rem; }
.prov-UNKNOWN { background: #334155; color: #cbd5e1; }
.prov-ASSUMED { background: #7c2d12; color: #fdba74; }
.prov-PROPOSED { background: #0c4a6e; color: #7dd3fc; }
.prov-DERIVED { background: #164e63; color: #67e8f9; }
.prov-MEASURED { background: #064e3b; color: #6ee7b7; }
.prov-FACT { background: #14532d; color: #86efac; }
.prov-DECIDED { background: #4c1d95; color: #c4b5fd; }
.status-badge { font-size: .72rem; color: #94a3b8; border: 1px dashed #475569; border-radius: 4px; padding: 1px 6px; margin-right: .4rem; }
.status-waived { color: #94a3b8; border-color: #64748b; }
.status-superseded { color: #94a3b8; border-color: #64748b; text-decoration: line-through; }
.title { font-size: .9rem; }
.help-link { display: inline-grid; place-items: center; width: 1.25rem; height: 1.25rem; margin-left: .4rem; border: 1px solid #475569; border-radius: 50%; font-size: .75rem; font-weight: 700; text-decoration: none; }
.edge-label { color: #f472b6; font-family: ui-monospace, monospace; font-size: .72rem; margin-right: .4rem; }
.stale { opacity: .55; }
.stale .title, .stale .id-badge { text-decoration: line-through; }
.node-card { margin: .3rem 0 .6rem .5rem; padding: .6rem .8rem; background: #0f172a; border-left: 3px solid #475569; border-radius: 0 6px 6px 0; }
.statement { margin: 0 0 .5rem; }
dl.fields { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: .15rem .6rem; font-size: .8rem; }
dl.fields dt { color: #94a3b8; font-family: ui-monospace, monospace; }
dl.fields dd { margin: 0; }
.answer { color: #a5f3fc; }
table { border-collapse: collapse; width: 100%; font-size: .8rem; }
th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid #334155; }
th { color: #94a3b8; font-weight: 600; }
.mono { font-family: ui-monospace, monospace; }
a { color: #7dd3fc; }
.unk-list li { margin: .2rem 0; }
`;

const EXTRA_SKIP = new Set([
  "id",
  "type",
  "title",
  "statement",
  "provenance_type",
  "status",
  "falsification_conditions",
  "adversarial_critique",
]);

export type VizOutput = {
  html: string;
  summary: ReportSummary;
};

const graphLabel = (value: unknown): string =>
  String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/gu, " ");

export function buildDot(events: readonly GraphEvent[]): string {
  const graph = fold(events);
  const lines = ["digraph Ariadne {", "  rankdir=LR;"];
  for (const node of [...graph.nodes.values()].sort((left, right) => left.id.localeCompare(right.id))) {
    lines.push(`  ${JSON.stringify(node.id)} [label="${graphLabel(`${node.id}\\n${node.title}`)}"];`);
  }
  for (const edge of graph.edges) {
    lines.push(`  ${JSON.stringify(edge.source)} -> ${JSON.stringify(edge.target)} [label="${graphLabel(edge.type)}"];`);
  }
  lines.push("}", "");
  return lines.join("\n");
}

export function buildMermaid(events: readonly GraphEvent[]): string {
  const graph = fold(events);
  const ids = [...graph.nodes.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((node, index) => ({ node, key: `n${index}` }));
  const keys = new Map(ids.map(({ node, key }) => [node.id, key]));
  const lines = ["flowchart TD"];
  for (const { node, key } of ids) {
    lines.push(`  ${key}["${graphLabel(`${node.id}: ${node.title}`)}"]`);
  }
  for (const edge of graph.edges) {
    const source = keys.get(edge.source);
    const target = keys.get(edge.target);
    if (source && target) lines.push(`  ${source} -->|${graphLabel(edge.type)}| ${target}`);
  }
  return `${lines.join("\n")}\n`;
}

export function buildSvg(events: readonly GraphEvent[]): string {
  const graph = fold(events);
  const nodes = [...graph.nodes.values()].sort((left, right) => left.id.localeCompare(right.id));
  const width = 720;
  const rowHeight = 34;
  const height = Math.max(48, (nodes.length + 1) * rowHeight);
  const escSvg = (value: unknown): string =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Ariadne epistemic graph" viewBox="0 0 ${width} ${height}">`,
    `  <title>Ariadne epistemic graph</title>`,
  ];
  nodes.forEach((node, index) => {
    const y = (index + 1) * rowHeight;
    lines.push(`  <text x="12" y="${y}" font-family="monospace" font-size="14">${escSvg(`${node.id}: ${node.title}`)}</text>`);
  });
  lines.push("</svg>", "");
  return lines.join("\n");
}

export function buildViz(
  events: readonly GraphEvent[],
  options: { cardsPrefix: string; bookHref?: string; graphPath?: string; rootId?: string },
): VizOutput {
  const {
    cardsPrefix,
    bookHref = "../../docs/nine_operations_software_en.html",
    graphPath,
    rootId,
  } = options;
  const graph = fold(events);

  const renderNode = (
    id: string,
    edgeType: string | null,
    isOpen: boolean,
    seen: Set<string>,
    anchorPrefix: string,
    filter?: Set<string>,
  ): string => {
    const node = graph.nodes.get(id);
    if (!node) {
      return `<li class="node tg-other"><span class="id-badge">${esc(id)}</span> [missing]</li>`;
    }
    if (seen.has(id)) {
      // A back-edge or cross-link lands in `seen` (deductive cycles cannot
      // exist per 00-core: a cycle must be a CTR node), so traversal
      // terminates here, mirroring the text report's repeat stub.
      const edge = edgeType ? `<span class="edge-label">${esc(edgeType)}</span>` : "";
      return `<li>${edge}<a href="#${esc(anchorPrefix)}-${esc(id)}">${esc(id)} (rendered above)</a></li>`;
    }
    seen.add(id);
    const group = typeGroup(node.type);
    const status = String(node.status ?? "ACTIVE");
    const stale = TOMBSTONE_STATUSES.has(status);
    const helpHref = `${bookHref}#diagram-${HELP_DIAGRAMS[node.type] ?? 10}`;
    const lines: string[] = [];
    lines.push(`<li id="${esc(anchorPrefix)}-${esc(id)}" class="node tg-${group}${stale ? " stale" : ""}">`);
    lines.push(`<details class="node"${isOpen ? " open" : ""}>`);
    const edge = edgeType ? `<span class="edge-label">${esc(edgeType)}</span>` : "";
    lines.push(
      `<summary>${edge}<span class="id-badge">${esc(node.id)}</span>` +
        `<span class="type-badge">${esc(node.type)}</span>` +
        `<span class="prov-chip prov-${esc(node.provenance_type)}">${esc(node.provenance_type)}</span>` +
        `<span class="status-badge status-${esc(status.toLowerCase().replaceAll("_", "-"))}">${esc(status)}</span>` +
        `<span class="title">${esc(node.title)}</span>` +
        `<a class="help-link" href="${esc(helpHref)}" target="_blank" rel="noreferrer" ` +
        `aria-label="Open methodology help for ${esc(node.type)}" title="Open the book at the relevant diagram">?</a></summary>`,
    );
    lines.push(`<div class="node-card">`);
    lines.push(`<p class="statement">${esc(node.statement)}</p>`);
    lines.push(`<dl class="fields">`);
    lines.push(`<dt>Card</dt><dd><a href="${esc(cardsPrefix)}/${esc(node.id)}.md">${esc(node.id)}.md</a></dd>`);
    lines.push(`<dt>Answer</dt><dd class="answer">${esc(answerText(node))}</dd>`);
    const critique = (node as unknown as { adversarial_critique?: string }).adversarial_critique;
    if (critique) lines.push(`<dt>Critique</dt><dd>${esc(fmt(critique))}</dd>`);
    const conditions = node.falsification_conditions;
    if (conditions && conditions.length > 0) {
      lines.push(`<dt>Falsification</dt><dd>${conditions.map(esc).join("; ")}</dd>`);
    }
    if (node.confidence_level !== undefined) {
      lines.push(`<dt>Confidence</dt><dd>${esc(node.confidence_level)}</dd>`);
    }
    for (const [key, value] of Object.entries(node as unknown as Record<string, unknown>)) {
      if (!EXTRA_SKIP.has(key) && value !== undefined) {
        lines.push(`<dt>${esc(key)}</dt><dd>${esc(fmt(value))}</dd>`);
      }
    }
    lines.push(`</dl>`);
    const kids = childEdges(graph, id).filter((edge) => !filter || filter.has(edge.source));
    if (kids.length > 0) {
      lines.push(`<ul class="children">`);
      for (const edge of kids) lines.push(renderNode(edge.source, edge.type, false, seen, anchorPrefix));
      lines.push(`</ul>`);
    }
    lines.push(`</div></details></li>`);
    return lines.join("\n");
  };

  const sections: ReportSummary["sections"] = [];
  let remainderRoots: string[] = [];
  let mode: ReportSummary["mode"] = "forest";
  let forest: ReturnType<typeof computeForest> | undefined;
  if (rootId !== undefined) {
    const node = graph.nodes.get(rootId);
    if (!node || node.type !== "FRAME") throw new Error(`Unknown FRAME: ${rootId}`);
    mode = "tree";
    sections.push({ root: rootId, reachable: reachableCount(graph, rootId) });
  } else {
    forest = computeForest(graph);
    sections.push(...forest.sections);
    remainderRoots = forest.remainderRoots;
  }

  const active = [...graph.nodes.values()].filter((n) => !TERMINAL_STATUSES.has(String(n.status ?? "ACTIVE"))).length;
  const openUnknowns = [...graph.nodes.values()]
    .filter((node) => node.type === "UNK" && !isClosedUnknown(node))
    .sort((a, b) => a.id.localeCompare(b.id));
  const candidates = [...graph.nodes.values()].filter((node) => node.type === "CAN" && !TERMINAL_STATUSES.has(String(node.status ?? "ACTIVE"))).length;

  const frontierHeader: string[] = [];
  frontierHeader.push(`<section class="panel"><h2>Frontier</h2>`);
  frontierHeader.push(`<p class="meta">Nodes: ${graph.nodes.size} · Edges: ${graph.edges.length} · Active: ${active} · Candidates: ${candidates} · Open unknowns: ${openUnknowns.length}</p>`);
  if (openUnknowns.length > 0) {
    frontierHeader.push(`<ul class="unk-list">`);
    for (const unknown of openUnknowns) {
      frontierHeader.push(
        `<li><a href="${esc(cardsPrefix)}/${esc(unknown.id)}.md">${esc(unknown.id)}</a> — ${esc(trunc(unknown.statement, 160))}</li>`,
      );
    }
    frontierHeader.push(`</ul>`);
  }
  frontierHeader.push(`</section>`);

  const treeSections: string[] = [];
  for (const [index, section] of sections.entries()) {
    const rootNode = graph.nodes.get(section.root);
    const heading = rootNode ? `${section.root} — ${rootNode.title ?? ""}` : section.root;
    const seen = new Set<string>();
    treeSections.push(
      `<section class="panel"><h2>Tree: ${esc(heading)} (${section.reachable} nodes reachable)</h2>` +
        `<ul class="tree-root">${renderNode(section.root, null, true, seen, `node-${index}`)}</ul></section>`,
    );
  }
  if (forest && forest.remainderNodes.size > 0) {
    treeSections.push(
      `<section class="panel"><h2>Remainder: ${forest.remainderNodes.size} nodes outside FRAME-rooted trees</h2>` +
        `<ul class="tree-root">${remainderRoots
          .map((root) => renderNode(root, null, true, new Set<string>(), "node-r", forest.remainderNodes))
          .join("\n")}</ul></section>`,
    );
  }

  let shown = 0;
  let appends = 0;
  const logRows: string[] = [];
  events.forEach((event, index) => {
    if (event.kind !== "node") return;
    appends += 1;
    const node = event.node;
    const decisive = LOG_TYPES.has(node.type);
    const tombstone = TOMBSTONE_STATUSES.has(String(node.status));
    if (!decisive && !tombstone) return;
    shown += 1;
    const critique = (node as unknown as { adversarial_critique?: string }).adversarial_critique;
    logRows.push(
      `<tr><td class="mono">${index}</td><td>${decisive ? "append" : "TOMBSTONE"}</td>` +
        `<td class="mono">${esc(node.id)}</td><td>${esc(node.status ?? "-")}</td>` +
        `<td><a href="${esc(cardsPrefix)}/${esc(node.id)}.md">${esc(node.id)}.md</a></td>` +
        `<td>${esc(trunc(critique || node.statement, 160))}</td></tr>`,
    );
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ariadne Decision Tree — ${esc(graphPath ?? "graph")}</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1>Ariadne Decision Tree Report</h1>
<p class="meta">graph: ${esc(graphPath ?? "-")} | mode: ${mode} | ${graph.nodes.size} nodes | ${graph.edges.length} edges</p>
</header>
${frontierHeader.join("\n")}
<main>
${treeSections.join("\n")}
<section class="panel"><h2>Change Log (filter: appends of CAN/DEC/EVD/UNK + tombstones; ${shown} of ${appends} appends shown)</h2>
<table>
<thead><tr><th>#</th><th>Event</th><th>ID</th><th>Status</th><th>Card</th><th>Note</th></tr></thead>
<tbody>
${logRows.join("\n")}
</tbody>
</table>
</section>
</main>
</body>
</html>
`;

  return {
    html,
    summary: {
      mode,
      sections,
      remainder_roots: remainderRoots,
      change_log: { shown, appends },
    },
  };
}

const VIZ_USAGE = "Usage: ariadne viz [--format (dot|svg|mermaid)]\n";

export async function runViz(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(VIZ_USAGE);
    return 0;
  }
  const output = parseOutputFormat<"dot" | "svg" | "mermaid" | "html">(
    args,
    ["dot", "svg", "mermaid"],
    "html",
    VIZ_USAGE.trim(),
  );
  const legacyJson = output.rest.includes("--json");
  const rest = output.rest.filter((arg) => arg !== "--json");
  if (rest.length > 1 || rest.some((arg) => arg.startsWith("--"))) {
    throw syntaxError(VIZ_USAGE.trim());
  }
  const frameArg = rest[0];

  const { environment, storage } = await resolveCliWorkspace(io);
  const events = await storage.readEvents();
  if (!legacyJson && output.format === "dot") {
    io.stdout.write(buildDot(events));
    return 0;
  }
  if (!legacyJson && output.format === "svg") {
    io.stdout.write(buildSvg(events));
    return 0;
  }
  if (!legacyJson && output.format === "mermaid") {
    io.stdout.write(buildMermaid(events));
    return 0;
  }
  const reportsDirectory = join(storage.rootDirectory, "reports");
  await mkdir(reportsDirectory, { recursive: true });
  // Hrefs resolve from the report's own directory, so card links are
  // relative to it (../cards) rather than project-relative.
  const cardsHref = relative(reportsDirectory, storage.cardsDirectory).replaceAll("\\", "/") || ".";
  const viz = buildViz(await storage.readEvents(), {
    cardsPrefix: cardsHref,
    bookHref: relative(
      reportsDirectory,
      join(environment.rootPath, "docs", "nine_operations_software_en.html"),
    ).replaceAll("\\", "/"),
    graphPath: toRootRelative(environment.rootPath, storage.graphPath),
    rootId: frameArg,
  });
  const ordinal = await nextReportOrdinal(reportsDirectory);
  const slugSource = viz.summary.sections[0]?.root ?? frameArg ?? "forest";
  const fileName = `${ordinal}-${slugify(slugSource)}.html`;
  await writeFile(join(reportsDirectory, fileName), viz.html, "utf8");

  if (legacyJson) {
    io.stdout.write(
      `${JSON.stringify({
        file: `${toRootRelative(environment.rootPath, reportsDirectory)}/${fileName}`,
        ...viz.summary,
      })}\n`,
    );
    return 0;
  }
  io.stdout.write(`wrote ${toRootRelative(environment.rootPath, reportsDirectory)}/${fileName}\n`);
  return 0;
}
