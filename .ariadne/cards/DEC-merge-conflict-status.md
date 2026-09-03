# DEC-merge-conflict-status: Give merge contradictions an explicit lifecycle

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Represent an unresolved graph-native merge contradiction as CTR with status MERGE_CONFLICT and conflict_kind branch_merge; exempt it explicitly from Separation Diversity and let merge-specific checks own its unresolved policy.

## Payload

```json
{
  "decision_scope": "epistemic-merge-contradiction-status"
}
```
