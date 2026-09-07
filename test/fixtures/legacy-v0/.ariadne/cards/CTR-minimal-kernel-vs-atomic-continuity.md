# CTR-minimal-kernel-vs-atomic-continuity: Deletable minimum versus atomic continuation

- Status: RESOLVED
- Provenance: DECIDED
- Type: CTR
- Revised: 2026-08-24

## Statement

The system must add no permanent runtime when owner artifacts suffice, yet any retained kernel must own enough neutral durable state to prevent duplicate dispatch across crashes and concurrent resumers.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate"
  ],
  "improving_parameter": "minimal code, mutable state, and deletion cost",
  "degrading_parameter": "atomic dispatch intent and unique restart disposition",
  "hard_invariants": [
    "no duplicate owner effect",
    "no shadow owner state",
    "delete or inline when baseline passes"
  ],
  "resolution": "Separate by state ownership and evidence stage: the neutral module owns only atomic pointer continuity unless Rung 6 proves no module is needed."
}
```
