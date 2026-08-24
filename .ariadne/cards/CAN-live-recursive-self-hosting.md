# CAN-live-recursive-self-hosting: Live recursive self-hosting

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Let methodology-authoring, harness-authoring, and the Orchestration Harness invoke and rewrite one another in one live run until no diff remains.

## Payload

```json
{
  "falsification_conditions": [
    "A live invocation graph can be proven acyclic while every component still rewrites its own active dependency"
  ],
  "mechanism_class": "mutual runtime recursion",
  "separation_principle": "none",
  "state_owner": "one mutable live working set",
  "supported_invariants": [
    "automatic iteration"
  ],
  "known_violations": [
    "acyclic runtime dependencies",
    "immutable input provenance",
    "unambiguous failure ownership"
  ]
}
```
