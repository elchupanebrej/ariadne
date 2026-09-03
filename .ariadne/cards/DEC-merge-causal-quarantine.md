# DEC-merge-causal-quarantine: Quarantine the causal branch-change closure

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Quarantine only branch-added or branch-modified materialized values in the transitive causal influence closure of a conflict, using deductive, support, invalidation, and node dependency relations but not non-causal references.

## Payload

```json
{
  "decision_scope": "epistemic-merge-quarantine-closure"
}
```
