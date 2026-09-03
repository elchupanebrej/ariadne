# EVDREQ-frame-continuation-prototype-r3: Frame continuation prototype

- Status: REMOVED
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-08-30

## Statement

Test whether the existing graph and report engine can produce one correct next action for representative frame states without new mutable state.

## Payload

```json
{
  "claim": "CAN-graph-native-frame-continuation",
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "Deterministic examples for open evidence, unresolved contradiction, blocked dependency, and decision-ready frames each return exactly one valid next operation with dependencies, unlocks, and an executable command or template.",
  "fail_condition": "Any example requires a global workflow state, duplicates rule semantics, returns multiple primary actions, or recommends a blocked node.",
  "providers": [
    "Ariadne unit test suite"
  ],
  "method": "Add the smallest table-driven tests around the existing report/status projection before implementation.",
  "environment": "Ariadne repository test environment",
  "stopping_rule": "Stop after every representative state either returns one valid next action or falsifies graph-only derivation.",
  "owner": "Ariadne maintainer"
}
```
