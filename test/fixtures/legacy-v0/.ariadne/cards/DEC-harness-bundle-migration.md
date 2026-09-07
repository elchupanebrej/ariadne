# DEC-harness-bundle-migration: Migrate bundles without changing active pins

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

New attempts move to an active successor bundle while existing attempts drain on their deprecated pinned bundle; format changes use expand-contract compatibility, and an attempt that cannot drain requires an owner-approved terminal receipt followed by a new attempt rather than an in-place upgrade.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-compatibility-policy",
    "DEP-harness-lifecycle-propagation",
    "DEC-runtime-safety-recovery-contract"
  ],
  "owner": "user",
  "decision_basis": "Pin mutation destroys replay and audit guarantees; staged overlap preserves both old and new consumers until migration evidence passes.",
  "invariants": [
    "an Orchestration Attempt never changes component or bundle pins",
    "old and new formats overlap only under an owner-gated transition",
    "ambiguous effects are resolved before any replacement attempt",
    "deprecated bundles reject new attempts but may resume explicitly supported pinned attempts"
  ],
  "migration_path": [
    "publish successor components and compatibility receipts",
    "assemble and activate successor Tested Release Bundle",
    "deprecate predecessor for new attempts",
    "drain predecessor attempts and migrate owner artifacts under expand-contract receipts",
    "contract compatibility paths after parity and absence checks"
  ],
  "adversarial_critique": [
    "Drain-only migration can strand attempts; non-drainable work requires an owner-approved terminal receipt and a new pinned attempt."
  ]
}
```
