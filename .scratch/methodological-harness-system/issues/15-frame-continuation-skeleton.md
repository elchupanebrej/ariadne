# 15 — Frame continuation skeleton (ready + insufficient-information)

**What to build:** A fresh session passing a frame id to the existing status or report CLI path receives a continuation block containing exactly one next operation — its `next_action`, `operation`, `command_or_template`, `dependencies`, and `unlocks` — for decision-ready frames (record the decision with its satisfies/answers edges) and insufficient-information frames (raise the explicit unknown/assumption plus one evidence request). The continuation is derived by a pure projection over the frame-scoped subgraph (existing edge types, direct plus transitive, intersected with non-terminal nodes); the projection reads the materialized graph and writes nothing. Readiness logic lives as a pure function over the materialized graph plus frame id, colocated with the existing status report builder's level; CLI command files stay thin.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Frame-scoped subgraph projection derived from existing edge semantics only; no new mutable state, no writes.
- [x] `ready` class: candidate with all supporting value/evidence edges SUPPORTED/validating, no active contradicts/invalidates/falsifies edge, no decision node joined by answers/satisfies → one operation: record the decision.
- [x] `insufficient-information` class: UNKNOWN/ASSUMED provenance nodes lacking tests/falsifies edges and not covered by an evidence request → one operation: raise explicit unknown plus evidence request.
- [x] Exactly one next action per response; response carries `next_action`, `operation`, `command_or_template`, `dependencies`, `unlocks`.
- [x] Same seeded graph and frame id produce the same continuation across runs (determinism check).
- [x] Table-driven tests over seeded graphs, one case per implemented class, asserting external CLI JSON output only.

## Comments

Parent spec: `specs/graph-native-continuation-and-package-repair.md`. Evidence: `EVD-graph-native-harness-contract-r1`, `EVD-frame-continuation-prototype-r3` (falsified the current report JSON).
