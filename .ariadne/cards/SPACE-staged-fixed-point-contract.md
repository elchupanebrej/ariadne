# SPACE-staged-fixed-point-contract: Fixed-point mechanism space

- Status: ACTIVE
- Provenance: PROPOSED
- Type: SPACE
- Revised: 2026-09-07

## Statement

Compare live recursion, detached audit, and staged immutable snapshots across build and runtime ownership, fixed-point executability, semantic equivalence, reviewer independence, and external-evidence separation.

## Payload

```json
{
  "behavior": "Produce a stable v1 core only after complete self-application preserves P/A/R/L.",
  "hard_invariants": [
    "immutable version and digest pins",
    "acyclic runtime dependencies",
    "two independent complete assessments",
    "self-consistency never raises empirical confidence",
    "fail closed on normative delta or assessor disagreement"
  ],
  "dimensions": [
    "time separation",
    "state owner",
    "build versus runtime dependency",
    "equivalence boundary",
    "stop owner"
  ],
  "candidate_classes": [
    "CAN-live-recursive-self-hosting",
    "CAN-detached-fixed-point-audit",
    "CAN-staged-snapshot-fixed-point"
  ],
  "pruned_combinations": [
    {
      "candidate": "live recursive self-hosting",
      "reason": "creates live ownership and failure cycles"
    },
    {
      "candidate": "detached audit-only comparison",
      "reason": "checks snapshots but does not execute the method operator"
    }
  ]
}
```
