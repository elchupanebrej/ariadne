import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseConfigLine } from "./solution.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 1. Assert parser implementation behavior across 4 deterministic cases
assert.deepEqual(parseConfigLine("A=1"), ["A", "1"]);
assert.deepEqual(parseConfigLine("TOKEN=a=b"), ["TOKEN", "a=b"]);
assert.throws(() => parseConfigLine("=x"), /Invalid config line/);
assert.throws(() => parseConfigLine("NO_DELIMITER"), /Invalid config line/);

// 2. Validate example graph integrity and completeness
const graphPath = resolve(__dirname, ".ariadne/GRAPH.jsonl");
const content = readFileSync(graphPath, "utf-8");
const events = content.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
const lines = events.flatMap(e => (e.kind === "node" ? [e.node] : e.kind === "edge" ? [e.edge] : []));

const nodeIds = new Set(lines.filter(l => l.id).map(l => l.id));
const requiredNodes = [
  "FRAME-config-line-parser",
  "SPACE-config-line-parser",
  "CAN-first-delimiter-stdlib",
  "CAN-json-input",
  "CAN-environment-boundary",
  "VAL-SELECT-config-line-parser",
  "EVDREQ-config-line-parser-r3",
  "EVD-config-line-parser-r3",
  "DEC-config-line-parser",
];

for (const req of requiredNodes) {
  assert.ok(nodeIds.has(req), `Missing required node ${req} in example graph`);
}

// 3. Verify edges exist linking the nodes
const edges = lines.filter(l => l.source && l.target);
assert.ok(edges.length >= 7, "Example graph must declare relational edges");

console.log("All 4 deterministic config line parser checks and graph integrity checks passed.");

// 4. Gate the example graph through the real CLI (build first: npm run build)
const cli = resolve(__dirname, "../../../../dist/cli/index.js");
const gate = spawnSync(process.execPath, [cli, "gate", "all", "--strict"], {
  cwd: __dirname,
  stdio: "inherit",
});
assert.equal(gate.status, 0, "Strict gate failed on the example graph");
console.log("Strict gate passed on the example graph.");
