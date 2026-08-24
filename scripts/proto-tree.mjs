#!/usr/bin/env node
// Throwaway readability mockup for ticket 01 (decision-tree-report).
// Renders .ariadne/GRAPH.jsonl as: forest of FRAME-rooted trees + filtered change log.
// Grammar under test: CTR-RPT-01 / ASM-RPT-02. Decisions: DEC-RPT-03/04/07/10.

import { readFileSync } from "node:fs";

const GRAPH = ".ariadne/GRAPH.jsonl";
const LOG_TYPES = new Set(["CAN", "DEC", "EVD", "UNK"]);
const TOMBSTONES = new Set(["REMOVED", "INVALIDATED"]);
const WIDTH = 100; // every printed line stays inside this budget (CTR-RPT-01)

const raw = readFileSync(GRAPH, "utf8").trim().split("\n").map((l) => JSON.parse(l));

// Append-only fold: latest append per node id wins; edges dedup on the triple.
const nodes = new Map();
for (const r of raw) if (r.kind === "node") nodes.set(r.node.id, r.node);
const edgeKeys = new Set();
const edges = [];
for (const r of raw) {
  if (r.kind !== "edge") continue;
  const k = `${r.edge.source}|${r.edge.target}|${r.edge.type}`;
  if (!edgeKeys.has(k)) { edgeKeys.add(k); edges.push(r.edge); }
}

// Live-graph orientation: every edge reads "source depends on / derives from /
// is answered by target", so source is downstream of target. Children(X) =
// sources of edges targeting X. A root is a node that is never a source.
const childrenOf = new Map();
for (const e of edges) {
  if (!childrenOf.has(e.target)) childrenOf.set(e.target, []);
  childrenOf.get(e.target).push(e);
}
const childEdges = (id) =>
  (childrenOf.get(id) ?? []).slice().sort((a, b) => a.source.localeCompare(b.source));
const isSource = new Set(edges.map((e) => e.source));

function trunc(s, max) {
  if (!s) return "";
  s = String(s).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
const firstSentence = (s) => trunc(String(s ?? "").split(/(?<=\.)\s/)[0], WIDTH);

// DEC-RPT-07: intermediate answer derived from the existing node payload.
function answerText(n) {
  if (n.type === "UNK") return n.resolved_by ? `resolved by ${n.resolved_by}` : "~ UNRESOLVED";
  if (n.type === "EVD") return n.verdict ? `verdict: ${trunc(n.verdict, 40)}` : firstSentence(n.statement);
  return firstSentence(n.statement);
}

// One full render per node per section; repeats become one-line stubs.
// ponytail: prefixes past ANCHOR_AT overflow WIDTH by fixed-part length on
// very deep chains; upgrade path is line-wrapping the head.
const ANCHOR_AT = 24;

function emit(out, id, prefix, label, isLast, seen, deferred) {
  const branch = `${isLast ? "`-- " : "|-- "}${label} --> `;
  const n = nodes.get(id);
  if (!n) { out.push(`${prefix}${branch}${id} [missing]`); return; }
  const cont = prefix + (isLast ? "     " : "|    ");
  const head = `${prefix}${branch}${id} [${n.status}] `;
  if (seen.has(id)) { out.push(`${prefix}${branch}${id} (rendered above)`.trimEnd()); return; }
  seen.add(id);
  const tBudget = WIDTH - head.length;
  out.push(tBudget >= 4 ? `${head}${trunc(n.title, tBudget)}` : head.trimEnd());
  out.push(`${cont.slice(0, ANCHOR_AT + 1)}~ ${trunc(answerText(n), WIDTH - Math.min(cont.length, ANCHOR_AT + 1) - 2)}`);
  const kids = childEdges(id);
  kids.forEach((e, i) => {
    const last = i === kids.length - 1;
    if (cont.length > ANCHOR_AT && !seen.has(e.source)) {
      out.push(`${cont}${last ? "`" : "|"}`.trimEnd() + "-- ...");
      deferred.push({ id: e.source, label: e.type });
      seen.add(e.source);
    } else {
      emit(out, e.source, cont, e.type, last, seen, deferred);
    }
  });
}

// Drain subtrees that outgrew the inline prefix as fresh column-0 blocks.
function emitRoot(out, rid, filterKids) {
  const rn = nodes.get(rid);
  out.push(`${rid} [${rn.status}] ${trunc(rn.title, WIDTH - rid.length - String(rn.status).length - 4)}`);
  out.push(`~ ${trunc(answerText(rn), WIDTH - 2)}`);
  const seen = new Set([rid]);
  const deferred = [];
  const kids = childEdges(rid).filter((e) => !filterKids || filterKids.has(e.source));
  kids.forEach((e, i) => emit(out, e.source, "", e.type, i === kids.length - 1, seen, deferred));
  let d;
  while ((d = deferred.shift())) {
    const dn = nodes.get(d.id);
    out.push(`-- subtree continued: ${d.label} --> ${d.id} --`);
    out.push(`${d.id} [${dn.status}] ${trunc(dn.title, WIDTH - d.id.length - String(dn.status).length - 4)}`);
    out.push(`~ ${trunc(answerText(dn), WIDTH - 2)}`);
    const dkids = childEdges(d.id);
    dkids.forEach((e, i) => emit(out, e.source, "", e.type, i === dkids.length - 1, seen, deferred));
  }
  return seen;
}

const out = [];
out.push("ARIADNE DECISION-TREE REPORT - PROTOTYPE MOCKUP (ticket 01)");
out.push(`graph: ${GRAPH} | nodes: ${nodes.size} | edges: ${edges.length}`);
out.push("");

// Section per root FRAME (DEC-RPT-08 forest default), full subtree (DEC-RPT-03).
const covered = new Set();
let sections = 0;
const frameRoots = [...nodes.values()]
  .filter((n) => n.type === "FRAME" && !isSource.has(n.id))
  .map((n) => n.id)
  .sort();
for (const rid of frameRoots) {
  const probe = new Set([rid]);
  const stack = [rid];
  while (stack.length) {
    const id = stack.pop();
    for (const e of childEdges(id)) if (!probe.has(e.source)) { probe.add(e.source); stack.push(e.source); }
  }
  out.push(`== TREE ${++sections}: ${rid} (${probe.size} nodes reachable) ==`);
  for (const id of emitRoot(out, rid, null)) covered.add(id);
  out.push("");
}

// Remainder: nodes whose ancestry does not lead back to a FRAME-rooted tree.
const rest = [...nodes.keys()].filter((id) => !covered.has(id));
if (rest.length) {
  const restSet = new Set(rest);
  const restRoots = rest.filter((id) => !edges.some((e) => e.source === id && restSet.has(e.target)));
  out.push(`== REMAINDER: ${rest.length} nodes outside FRAME-rooted trees (${restRoots.length} local roots) ==`);
  for (const rid of restRoots.sort()) {
    emitRoot(out, rid, restSet);
    out.push("");
  }
}

// DEC-RPT-04: change log = decisive-type appends + tombstone flips, file order.
// Each step prints action / card link / reason (the three fields DEC-RPT-04 locks).
const nodeAppends = raw.filter((r) => r.kind === "node");
const logEvents = [];
raw.forEach((r, i) => {
  if (r.kind !== "node") return;
  const decisive = LOG_TYPES.has(r.node.type);
  const tombstone = TOMBSTONES.has(String(r.node.status));
  if (decisive || tombstone) logEvents.push({ i, n: r.node, act: decisive ? "append" : "TOMBSTONE" });
});

out.push(
  `== CHANGE LOG (filter: appends of CAN/DEC/EVD/UNK + tombstones; ${logEvents.length} of ${nodeAppends.length} appends shown) ==`,
);
for (const { i, n, act } of logEvents) {
  out.push(`[${String(i).padStart(3)}] ${act} ${n.id} -> ${n.status ?? "-"}`);
  out.push(`       .ariadne/cards/${n.id}.md`);
  out.push(`       ${trunc(n.adversarial_critique || n.statement, WIDTH - 7)}`);
}

console.log(out.join("\n"));

// Self-check: every folded node must surface somewhere; filter math must add up.
if (process.argv[2] === "--selfcheck") {
  const text = out.join("\n");
  const missing = [...nodes.keys()].filter((id) => !text.includes(id));
  if (missing.length) throw new Error(`nodes missing from render: ${missing.join(", ")}`);
  const decisiveAppends = nodeAppends.filter((r) => LOG_TYPES.has(r.node.type)).length;
  const tombstoneOnly = nodeAppends.filter((r) => !LOG_TYPES.has(r.node.type) && TOMBSTONES.has(String(r.node.status))).length;
  if (logEvents.length !== decisiveAppends + tombstoneOnly) {
    throw new Error("change-log filter count mismatch");
  }
  console.error(`selfcheck ok: ${nodes.size} nodes rendered, ${logEvents.length} = ${decisiveAppends} decisive + ${tombstoneOnly} tombstones`);
}
