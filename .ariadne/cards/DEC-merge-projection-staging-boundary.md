# DEC-merge-projection-staging-boundary: Stage only fully derived projections

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Hooks may automatically stage only fully derived index and card projections; synchronize graph-owned STATE fields in the working tree, leave STATE unstaged, and report that change explicitly.

## Payload

```json
{
  "decision_scope": "epistemic-merge-projection-staging",
  "adversarial_critique": "Adversarial review of DEC-merge-projection-staging-boundary: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
