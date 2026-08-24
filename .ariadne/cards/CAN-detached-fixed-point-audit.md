# CAN-detached-fixed-point-audit: Detached fixed-point audit

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Keep authoring packages independent and compare separately prepared before and after Method Contract snapshots in a detached audit step.

## Payload

```json
{
  "falsification_conditions": [
    "The audit can produce the complete self-instance and F output without invoking an owner of methodology application"
  ],
  "mechanism_class": "read-only snapshot auditor",
  "separation_principle": "State/Data",
  "state_owner": "auditor owns only normalized comparison output",
  "supported_invariants": [
    "acyclic runtime dependencies",
    "immutable inputs",
    "empirical evidence remains separate"
  ],
  "known_violations": [
    "does not demonstrate executable application of M to itself",
    "permits duplicated authoring semantics outside the contract"
  ]
}
```
