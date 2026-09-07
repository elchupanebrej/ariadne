# DEC-graph-native-frame-continuation: Graph-native frame continuation locks deepened status/report projection

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Lock the graph-native frame continuation contract: the existing ariadne status/report CLI path, deepened with an explicit frame argument, projects a frame-scoped continuation (six readiness classes, fail-closed priority order, exactly one next operation, pointer-only handoff) from GRAPH.jsonl alone. CAN-persisted-active-frame-spine and CAN-dedicated-orchestration-runtime are dispositioned as deferred, not falsified.

## Payload

```json
{
  "owner": "user via methodological-harness-system ticket 19",
  "candidate": "CAN-graph-native-frame-continuation",
  "decision_basis": "EVD-frame-continuation-prototype-r3 falsified the unimplemented report shape (no next_action, operation, dependencies, or unlocks); the Rung 3 table-driven check then passed (23 continuation tests in tests/cli/continuation.test.ts, full suite 680 green via npm run verify), meeting the ticket 14 research condition that no DEC lock precede the passing check. Evidence receipt: EVD-graph-native-harness-contract-r1.",
  "evidence": [
    "EVD-graph-native-harness-contract-r1",
    "EVD-frame-continuation-prototype-r3"
  ],
  "decided": {
    "continuation": "Deepen the existing ariadne status/report CLI path with an explicit frame argument that projects a frame-scoped continuation from GRAPH.jsonl alone; no new command, no new mutable state, no persisted spine, no runtime.",
    "readiness_classes": "six classes derived from existing node types, provenance_type, terminality, dependencies, and edge endpoint contracts",
    "priority": "fail-closed first (blocked-contradiction, blocked-evidence, blocked-dependency, ready, insufficient-information), exactly one next operation per response; a fully blocked frame emits a structured diagnostic instead of a recommendation",
    "response_shape": [
      "next_action",
      "operation",
      "command_or_template",
      "dependencies",
      "unlocks"
    ],
    "handoff": "pointer-only: the frame id is the complete handoff",
    "determinism": "stateless tie-breaking on frame derived_from order, then lexicographic node id"
  },
  "deferred_not_falsified": {
    "CAN-persisted-active-frame-spine": "stays deferred until pointer-only handoff demonstrably fails",
    "CAN-dedicated-orchestration-runtime": "stays deferred; the deepened CLI path satisfies the observed continuation need"
  },
  "receipt": {
    "table_driven_check": "tests/cli/continuation.test.ts (23 tests passing; full suite 680 green via npm run verify)",
    "follow_up_spec": ".scratch/methodological-harness-system/specs/graph-native-continuation-and-package-repair.md"
  },
  "scope_boundary": "This lock covers the graph-native continuation contract only; package-repair decisions are not locked by it.",
  "reopen_condition": "Implementing or extending the priority rules requires state beyond GRAPH.jsonl, pointer-only handoff demonstrably fails, or a real-host contract test contradicts the projection.",
  "adversarial_critique": [
    "Readiness rules are now part of the CLI contract; a bad priority rule can recommend a non-decision-significant node and this lock does not verify rule quality, only that the table-driven check passes today.",
    "Rung 3 validates projection logic only; no real-host contract test exists, so no host-integration claim is made by this lock.",
    "The projection assumes the existing graph is well-formed; a poisoned or sparse frame subgraph still degrades to fail-closed classes, but garbage-in diagnostics are only as good as the underlying edges.",
    "Pointer-only handoff presumes the caller can obtain a valid frame id; if frame discovery itself fails, the deferred spine becomes the fallback, not a falsified path."
  ],
  "tests_edge_cases": [
    "priority ordering: contradiction outranks outstanding evidence",
    "tie-breaks: declaration order then node id",
    "blocked diagnostic envelope",
    "absent or unknown frame id"
  ]
}
```
