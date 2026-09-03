# DEC-merge-topology-divergence: Treat combined topology violations as divergence

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

When individually valid branch models form an invalid topology only in combination, quarantine the conflicting semantic changes in a graph-native merge contradiction and complete Git merge with DIVERGED; malformed individual inputs remain FAILED.

## Payload

```json
{
  "decision_scope": "epistemic-merge-topology-policy"
}
```
