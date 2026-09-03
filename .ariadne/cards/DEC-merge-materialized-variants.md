# DEC-merge-materialized-variants: Preserve materialized variants, not copied history

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Preserve each incompatible materialized branch variant in the merge contradiction and use Git parent revisions plus normalized input digests for raw event history instead of duplicating event suffixes.

## Payload

```json
{
  "decision_scope": "epistemic-merge-preservation-target"
}
```
