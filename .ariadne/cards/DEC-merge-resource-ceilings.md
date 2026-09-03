# DEC-merge-resource-ceilings: Fail closed at deterministic merge resource ceilings

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Merge protocol v1 defines deterministic hard ceilings for input bytes, nodes, edges, and Causal Quarantine; repositories may lower but not raise them, and exceeding a ceiling fails without changing output.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resource-limits"
}
```
