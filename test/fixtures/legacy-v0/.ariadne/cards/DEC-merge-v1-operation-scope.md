# DEC-merge-v1-operation-scope: Limit the v1 contract to git merge

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Guarantee and test the first protocol only for ordinary git merge; rebase, cherry-pick, revert, and unsupported recursive cases fail closed until operation-specific fixtures establish support.

## Payload

```json
{
  "decision_scope": "epistemic-merge-git-operation-scope",
  "adversarial_critique": "Adversarial review of DEC-merge-v1-operation-scope: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
