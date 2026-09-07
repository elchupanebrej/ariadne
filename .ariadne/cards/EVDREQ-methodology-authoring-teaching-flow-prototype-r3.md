# EVDREQ-methodology-authoring-teaching-flow-prototype-r3: Check methodology-authoring teaching completion and recovery logic

- Status: OPEN
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-09-07

## Statement

The teaching flow must accept one contract-pinned complete path and one repaired path while rejecting shadow-contract, unpinned-contract, and circular-proof paths.

## Payload

```json
{
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "Deterministic complete and recovery scenarios reach independent status; copied-contract, unpinned, and self-consistency-as-effectiveness scenarios are rejected.",
  "fail_condition": "Any invalid path completes or a valid repaired path remains blocked.",
  "providers": [
    "throwaway pure reducer prototype"
  ]
}
```
