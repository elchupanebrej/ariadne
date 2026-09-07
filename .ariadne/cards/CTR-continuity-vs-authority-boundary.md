# CTR-continuity-vs-authority-boundary: Autonomous continuity without duplicated authority

- Status: RESOLVED
- Provenance: DECIDED
- Type: CTR
- Revised: 2026-09-07

## Statement

Fresh-session continuity benefits from automatic retry and recovery, while single-owner safety forbids the harness from inferring permission, effect, replay, rollback, compensation, or human intent.

## Payload

```json
{
  "falsification_conditions": [
    "A thinner implementation cannot express the selected semantics",
    "A real owner cannot provide the declarations the boundary requires",
    "Rung 8 fault injection violates a selected hard invariant"
  ],
  "resolved_by": "DEC-runtime-safety-recovery-contract",
  "resolution": "Separate by state ownership and operating condition: the harness persists dispatch intent, pointers, counters, cursors, and generic gates; it advances only on validated host and owner declarations, while every unknown, ambiguous, or authority-sensitive condition stops as waiting or failed.",
  "remaining_tradeoff": "Zero replay by default may reduce availability, but availability cannot compensate for duplicate-effect or authority violations."
}
```
