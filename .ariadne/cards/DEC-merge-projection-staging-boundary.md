# DEC-merge-projection-staging-boundary: Stage only fully derived projections

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Hooks may automatically stage only fully derived index and card projections; synchronize graph-owned STATE fields in the working tree, leave STATE unstaged, and report that change explicitly.

## Payload

```json
{
  "decision_scope": "epistemic-merge-projection-staging"
}
```
