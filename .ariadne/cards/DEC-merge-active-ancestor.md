# DEC-merge-active-ancestor: Keep the ancestor value active during divergence

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

For a conflicting existing node, keep the common-ancestor value active and expose the merge contradiction as its shadow; for add/add without an ancestor, keep the subject ID absent until reconciliation.

## Payload

```json
{
  "decision_scope": "epistemic-merge-active-subject"
}
```
