# UNK-kernel-packaging-substrate: Smallest neutral kernel substrate

- Status: RESOLVED
- Provenance: DECIDED
- Type: UNK
- Revised: 2026-09-07

## Statement

Whether the minimum orchestration contract needs no kernel, an Ariadne-owned extension, a co-located neutral file kernel, or a standalone service determines ownership, atomicity, and deletion cost.

## Payload

```json
{
  "falsification_conditions": [
    "The candidate cannot serialize dispatch intent across fresh processes",
    "The candidate copies workflow or epistemic state",
    "The candidate requires a daemon or dependency without a hard invariant",
    "The candidate cannot be deleted or inlined after a passing baseline"
  ],
  "owner": "harness design",
  "affected_candidates": [
    "CAN-thin-owner-artifact-baseline",
    "CAN-ariadne-controller-kernel",
    "CAN-colocated-neutral-file-kernel",
    "CAN-standalone-sqlite-kernel"
  ],
  "decision_deadline": "ticket 13 prototype review",
  "outcomes": [
    "Thin owner artifacts satisfy every hard invariant and the kernel is unnecessary",
    "A co-located neutral file ledger supplies the missing atomic continuation seam",
    "A separate service or database is required for correctness"
  ],
  "resolved_by": "DEC-kernel-packaging-substrate",
  "resolution": "Use a co-located neutral file kernel conditionally; thin owner artifacts remain its mandatory deletion baseline."
}
```
