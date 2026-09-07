# DEC-merge-local-install: Install merge integration locally and fail closed

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Commit repository attributes, install the merge driver and non-blocking hooks only in repository-local Git configuration through an idempotent command, verify them with a doctor command, fail closed when missing or incompatible, and never download code during merge.

## Payload

```json
{
  "decision_scope": "epistemic-merge-installation-contract",
  "adversarial_critique": "Adversarial review of DEC-merge-local-install: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
