# EVDREQ-harness-authoring-teaching-flow-prototype-r3: Check harness-authoring selection and recovery logic

- Status: OPEN
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-08-24

## Statement

The teaching flow must accept a justified minimal-kernel path and a valid trimmed-baseline path while rejecting copied owner state, ambiguous replay, pin drift, and live recursive self-building.

## Payload

```json
{
  "candidate": "CAN-failure-driven-harness-vertical-slice",
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "The complete recovered and thin-baseline scenarios pass; shadow-state, automatic-replay, unpinned, and runtime-recursive scenarios are rejected.",
  "fail_condition": "Any invalid path completes or either valid path remains blocked.",
  "providers": [
    "throwaway pure reducer prototype"
  ]
}
```
