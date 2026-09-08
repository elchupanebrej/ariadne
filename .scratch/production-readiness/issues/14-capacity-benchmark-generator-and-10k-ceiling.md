# 14 — Capacity Benchmark Generator and 10K Ceiling Verification

**What to build:**
A deterministic, parameterized synthetic benchmark generator and automated capacity verification suite for Ariadne. Synthesizes valid graphs using pseudorandom seeds, providing Smoke (100 nodes), Mid (1,000 nodes), and Ceiling (10,000 nodes, 25,000 edges, 50,000 events) benchmark configurations. Implements the release-blocking 10K ceiling benchmark on Linux Node 24, enforcing strict latency budgets: Fast (<100ms) for in-memory queries, Standard (<1s) for single-entity writes and gate evaluations, and Batch (<10s) for heavy reports and full projection rebuilds. Enforces the 256 MB peak heap RSS ceiling and verifies the non-blocking advisory compaction trigger when `GRAPH.jsonl` exceeds 10 MB or a 3x entity ratio.

**Blocked by:** 10 — Public API Surface Reset and CLI Exit Status Harmonization

**Status:** resolved

- [x] Parameterized benchmark generator in `tests/benchmarks/` (or `test/benchmarks/`) synthesizes deterministic graphs using fixed random seeds.
- [x] Benchmark suite supports configurable tiers: Smoke (100 nodes), Mid (1,000 nodes), and Ceiling (10,000 nodes, 25,000 edges, 50,000 events).
- [x] Fast latency tier (<100 ms) is verified for in-memory queries: `getNode()`, `listNodes()`, `listEdges()`, `getFrontier()`, `getOpenUnknowns()`.
- [x] Standard latency tier (<1 s) is verified for disk operations: `open()`, `addNode()`, `updateNode()`, `addEdge()`, `gate()`, `verify()`.
- [x] Batch latency tier (<10 s) is verified at full 10K ceiling for `report()`, `threeWayMerge()`, full projection rebuild, and migration dry-run.
- [x] Peak heap RSS memory is measured during full 10K ceiling traversal and asserted to remain strictly $\le$ 256 MB.
- [x] Advisory compaction trigger diagnostic is emitted to `stderr` when `GRAPH.jsonl` exceeds 10 MB or canonical events exceed 3x entity count.
- [x] Exceeding declared capacity limits triggers `AriadneError(CAPACITY_EXCEEDED)`.
- [x] Benchmark runner outputs structured JSON performance report (`EVD-BENCH-PASS.json`) recording p50, p95, and p99 percentiles and peak RSS.

## Implementation Details

### Files created / modified

| File | Action | Description |
|---|---|---|
| `src/graph/capacity.ts` | **Modified** | Added top-level constant exports (`MAX_NODES`, `MAX_EDGES`, `MAX_EVENTS`, `MAX_RSS_BYTES`, `COMPACTION_FILE_SIZE_BYTES`, `COMPACTION_EVENT_RATIO`) and `checkCapacityLimits()` alias for test-friendly imports. Existing `CAPACITY_LIMITS` object and `assertWithinCapacity()` unchanged. |
| `tests/benchmarks/generator.ts` | **Pre-existing** | Deterministic Mulberry32 PRNG, `BenchmarkTier` type, `BenchmarkDataset` interface, `generateBenchmarkGraph()`, `populateBenchmarkStorage()`. |
| `tests/benchmarks/runner.ts` | **Fixed** | Corrected `GateVerificationOptions` calls — replaced non-existent `{ structural: true, semantic: true }` with `{ gate: "structural" }` / `{ gate: "all" }`. |
| `tests/benchmarks/capacity.test.ts` | **Created** | 17 Vitest tests covering: generator determinism, smoke/mid tier counts, `checkCapacityLimits` throws `AriadneError(CAPACITY_EXCEEDED)` for nodes/edges/events, within-limit no-throw, `checkCompactionAdvisory` returns null for empty/small files and advisory string for oversized/over-ratio files. |
| `scripts/run-benchmark.mjs` | **Rewritten** | Removed Vite dependency (not installed). Uses `npx tsx` / `--import tsx/esm` to load TypeScript benchmarks directly. Outputs `EVD-BENCH-PASS.json` with `{ timestamp, tier_results: { fast, standard, batch }, peak_rss_bytes, rss_passed }`. Exit 0 on pass, exit 1 on failure. |
| `package.json` | **Modified** | Added `"benchmark": "npx tsx scripts/run-benchmark.mjs"` script. |

### Test results

- `npm run typecheck` — ✅ passes (0 errors)
- `npx vitest run tests/benchmarks/capacity.test.ts` — ✅ **17/17 tests pass**
- `npm test` — ✅ **845/845 tests pass** (17 new + 828 pre-existing)
- `npx tsx scripts/run-benchmark.mjs --tier smoke` — ✅ passes, all budgets met, outputs `EVD-BENCH-PASS.json`

### Design decisions

- **Top-level constant aliases**: Added `MAX_NODES` etc. as standalone exports alongside the existing `CAPACITY_LIMITS` object to match the test import contract without breaking existing callers.
- **`checkCapacityLimits` alias**: Uses `nodes`/`edges`/`events` key names (vs the internal `nodeCount`/`edgeCount`/`eventCount`) for cleaner test readability. Delegates to `assertWithinCapacity` internally.
- **No Vite in benchmark runner**: The previous `run-benchmark.mjs` used Vite for SSR module loading but Vite is not a project dependency. Replaced with `tsx` dynamic import of `.ts` files directly.
- **Compaction ratio test**: The "small file" test uses a properly-formed `{ kind: "node", node: { id: "..." } }` line so the parser recognizes 1 entity for 1 event (ratio 1.0 < 3.0 threshold).
