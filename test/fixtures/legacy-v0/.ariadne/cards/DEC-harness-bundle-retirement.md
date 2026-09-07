# DEC-harness-bundle-retirement: Retire only after executable absence and cleanup checks

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

A Tested Release Bundle may retire only after an active successor exists, required migrations pass, no supported consumer or active attempt references the old tuple, its owner-visible deadline arrives, owner approval is recorded, and the cleanup verification check passes; historical receipts remain auditable while new execution is rejected.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-bundle-migration",
    "DEC-harness-lifecycle-review-triggers"
  ],
  "owner": "user",
  "decision_basis": "Deprecation is not proof of safe removal, while deleting historical evidence would break provenance.",
  "retirement_predicate": [
    "successor bundle is active",
    "all required migration and compatibility receipts pass",
    "no registered supported consumer references the tuple",
    "no nonterminal Orchestration Attempt pins the tuple",
    "deprecation deadline reached",
    "component and bundle owner approvals recorded",
    "cleanup verification test passes"
  ],
  "cleanup_verification_test": "Scan registered support manifests and nonterminal attempt records for the exact retired tuple, then run bundle and compatibility gates with legacy execution disabled; pass only when references are absent, historical receipts remain readable, and new dispatch is rejected.",
  "invariants": [
    "retirement removes support, not audit history",
    "direct-use retirement remains each component owners policy",
    "expired or failed cleanup blocks retirement"
  ],
  "adversarial_critique": [
    "An absence scan cannot discover undeclared external direct users; retirement claims are bounded to registered bundle consumers and attempts, while direct-use support remains owner-defined."
  ]
}
```
