# Decide the capacity and performance evidence contract

Type: grilling
Status: resolved
Blocked by: 01, 04
Parent: [Ariadne production readiness](../map.md)

## Question

What graph size, event-history length, card count, concurrent-process count, and external-command output volume must the first production release support? Decide latency and memory budgets for common read, write, validation, report, merge, and recovery operations; the benchmark corpus; variance policy across supported platforms; and the threshold that triggers compaction or a different persistence mechanism.

## Answer

### Declared capacity envelope

The first production release supports up to 10,000 nodes, 25,000 edges, and 50,000 events in a single `GRAPH.jsonl`. Card files are bounded by the node ceiling (10,000 files). Retained reports are capped at 50 files with oldest-first pruning when the cap is exceeded. The declared concurrent-process count is 2 (one active writer plus one contending process). External-command output (stdout + stderr combined) is bounded at 1 MB; output beyond that limit is truncated before persistence.

### Memory budget

Peak RSS attributable to Ariadne's own heap (excluding Node.js baseline overhead and user-command child processes) must not exceed 640 MB when materializing and operating on a graph at the declared ceiling.

### Latency classes

Three order-of-magnitude tiers, tested at the declared ceiling on the parameterized benchmark generator. All platforms in the supported CI matrix must meet the same budget — no per-platform multipliers.

| Tier | Budget | Operations |
|---|---|---|
| Fast | < 100 ms | `getNode`, `listNodes`, `listEdges`, `getFrontier`, `getOpenUnknowns`, and all other queries on an already-materialized in-memory graph |
| Standard | < 1.5 s | `open` (full materialization from disk), `addNode`, `updateNode`, `removeNode`, `addEdge`, `removeEdge` (each a full transaction cycle), `gate`/`verify`, `loadAttempt`, `saveAttempt`, single `renderCard` |
| Batch | < 10 s | `report` (full decision-tree render), `threeWayMerge`, full recovery rebuild, full `renderIndex` + all cards regeneration, `readNotices` + `emitNotice` at scale, migration dry-run |

### Benchmark corpus

A parameterized generator produces synthetic graphs at configurable sizes (smoke: 100 nodes, mid: 1,000 nodes, ceiling: 10,000 nodes). The generator is checked into the repository. CI runs the smoke and mid tiers on every build; ceiling-tier benchmarks run as a dedicated job or gate and assert both latency-class compliance and peak-RSS compliance. The generator must produce deterministic output for a given seed so results are reproducible.

### Platform variance policy

One budget applies uniformly across every job in the supported CI matrix (Linux x64 Node 22/24, Windows x64 Node 24, macOS arm64 Node 24). The order-of-magnitude latency classes are wide enough to absorb filesystem and CPU differences without per-platform multipliers.

### Compaction trigger

When the event count exceeds 3× the materialized entity count (nodes + edges), or when `GRAPH.jsonl` exceeds 10 MB in absolute size — whichever condition is met first — the CLI emits a non-blocking advisory diagnostic on stderr recommending compaction. The first release defines this trigger and emits the advisory only; compaction implementation (a `compact` command with the same lock, backup, and verification rigor as migration per the persisted-format decision) is deferred to a subsequent release.

### Capacity-exceeded diagnostic

Add `CAPACITY_EXCEEDED` to the `DiagnosticCode` union as exit-class 2 (full stop). It fires when any declared ceiling is exceeded: node count, edge count, event count, command-output size, or peak RSS. The `detail` payload includes `{ limit: string, current: number, ceiling: number }`. Mandatory repair text directs the user to run compaction (when available) or archive completed subgraphs. This code is distinct from `INVALID_INPUT` (format errors), `INVARIANT_VIOLATION` (programming errors), and `TIMEOUT` (temporal bounds).

### Lock timeout

`LOCK_STALE_MS` is reduced from the current 300,000 ms (5 minutes) to 60,000 ms (60 seconds). At the declared ceiling, no single operation exceeds the 10-second batch tier; 60 seconds provides a 6× safety margin for ambiguous PID-ownership cases while keeping the failure experience tolerable. The PID-absent fast path from the persistence contract handles clean crashes before the timeout fires.
