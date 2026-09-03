# 19 — Record DEC lock for the continuation contract

**What to build:** With the Rung 3 table-driven check passing (tickets 15–16), the graph-native frame continuation recommendation becomes lock-eligible: record the DEC in the Ariadne graph locking `CAN-graph-native-frame-continuation` with the table-driven check as receipt, per the research's own condition that no DEC lock precedes the passing check. The lock records what was decided (deepened status/report continuation, pointer-only handoff, spine and runtime deferred) and cites the failing-to-passing evidence.

**Blocked by:** 16 — Fail-closed classes, priority order, tie-breaks, blocked diagnostic.

**Status:** resolved

- [x] All strict Ariadne gates green before recording the DEC (`npm run verify` 680 tests green; `ariadne verify --strict`, `ariadne gate all --strict` pass).
- [x] DEC node recorded with satisfies/answers edges to the candidates it settles; spine and dedicated-runtime candidates dispositioned as deferred, not falsified. `DEC-graph-native-frame-continuation` — satisfies → `CAN-graph-native-frame-continuation`, `CAN-persisted-active-frame-spine`, `CAN-dedicated-orchestration-runtime`; references → `EVD-graph-native-harness-contract-r1`, `EVD-frame-continuation-prototype-r3`.
- [x] Receipt cites the passing table-driven check (`tests/cli/continuation.test.ts`, 23 tests; suite 680 green) and the follow-up spec path (`specs/graph-native-continuation-and-package-repair.md`).
- [x] No unsupported DEC lock: package-repair decisions are not locked by this ticket (`scope_boundary` recorded in the DEC payload).

## Comments

Parent spec: `specs/graph-native-continuation-and-package-repair.md`. Research condition from ticket 14: "no DEC lock until the Rung 3 table-driven check passes."
