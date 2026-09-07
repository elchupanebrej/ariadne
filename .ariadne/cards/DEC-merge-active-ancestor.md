# DEC-merge-active-ancestor: Keep the ancestor value active during divergence

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

For a conflicting existing node, keep the common-ancestor value active and expose the merge contradiction as its shadow; for add/add without an ancestor, keep the subject ID absent until reconciliation.

## Payload

```json
{
  "decision_scope": "epistemic-merge-active-subject",
  "adversarial_critique": "Adversarial review of DEC-merge-active-ancestor: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
