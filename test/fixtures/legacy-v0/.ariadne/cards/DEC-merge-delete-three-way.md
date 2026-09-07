# DEC-merge-delete-three-way: Apply standard three-way deletion semantics

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Treat node removals and edge tombstones as materialized values under standard three-way rules: delete versus unchanged applies, identical deletes deduplicate, and delete versus modification diverges with the ancestor active.

## Payload

```json
{
  "decision_scope": "epistemic-merge-delete-semantics",
  "adversarial_critique": "Adversarial review of DEC-merge-delete-three-way: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
