# CAN-graph-native-frame-continuation: Graph-native frame continuation

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Deepen the existing status or report path so an explicit frame yields one ordered next operation, its command or record template, dependencies, unlocks, and structured fixes, all derived from the current graph.

## Payload

```json
{
  "mechanism_class": "on-demand graph-derived continuation contract",
  "operating_principle": "derive readiness and one next action at invocation time from the named frame and existing graph edges",
  "separation_principle": "State/Data",
  "state_owner": "Existing Ariadne graph only",
  "system_boundary": "Existing Ariadne CLI and report engine",
  "supported_invariants": [
    "single epistemic owner",
    "no new mutable state",
    "direct use",
    "host-neutral behavior",
    "pointer-only handoff"
  ],
  "known_violated_constraints": [
    "caller must possess or select a frame identifier"
  ],
  "useful_effect": "turns the current graph into an executable cold-start contract with the smallest change radius",
  "harm": "readiness rules become part of the CLI contract",
  "change_radius": "existing report/status projection, CLI JSON contract, and focused tests",
  "failure_modes": [
    "bad priority rule recommends a non-decision-significant node",
    "missing frame pointer leaves the global graph unbounded"
  ],
  "required_evidence_requests": [
    "EVDREQ-peer-repository-harness-patterns"
  ],
  "falsification_predicate": "Reject if a fresh session given a frame cannot identify and execute the correct next Ariadne operation from one response, or if implementation requires duplicated workflow semantics.",
  "next_check": {
    "claim_class": "Algorithmic logic",
    "minimum_rung": 3,
    "method": "Table-driven examples for open evidence, unresolved contradiction, blocked dependency, and decision-ready frames."
  },
  "refinement_2026_09_03": "Ticket 14 research: readiness and priority rules defined over existing semantics in docs/research/graph-native-harness-contract.md — six readiness classes (open-evidence, unresolved-contradiction, blocked-dependency, decision-ready, blocked, insufficient-information) with deterministic priority fail-closed first; evidence EVD-graph-native-harness-contract-r1. No DEC lock yet: lock-eligible after the Rung 3 table-driven check passes."
}
```
