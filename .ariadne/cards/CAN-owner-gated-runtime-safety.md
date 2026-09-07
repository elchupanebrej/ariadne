# CAN-owner-gated-runtime-safety: Owner-gated pointer-only runtime safety

- Status: SELECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Use a pointer-only harness safety boundary that validates generic pins and receipts, atomically records dispatch intent and accepted transitions, and advances only on owner declarations while the host retains physical enforcement.

## Payload

```json
{
  "mechanism_class": "owner-gated attempt state and fail-closed lifecycle gates",
  "separation_principle": "State/Data and Operating Conditions",
  "state_owner": "the harness owns generic attempt metadata; hosts and owners retain permissions, effects, traces, escalation policy, rollback, and compensation",
  "supported_invariants": [
    "deterministic fresh-session recovery",
    "zero replay by default",
    "single accepted dispatch intent per attempt revision and step",
    "owner-authoritative effect resolution",
    "pointer-only observability",
    "no duplicated semantic state"
  ],
  "known_constraints": [
    "trusted host and workspace are the v1 computing base",
    "real boundary and crash behavior require Rung 6 and Rung 8 evidence",
    "physical storage and atomicity mechanism remain undecided"
  ]
}
```
