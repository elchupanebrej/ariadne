# DEC-merge-resource-ceilings: Fail closed at deterministic merge resource ceilings

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Merge protocol v1 defines deterministic hard ceilings for input bytes, nodes, edges, and Causal Quarantine; repositories may lower but not raise them, and exceeding a ceiling fails without changing output.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resource-limits",
  "adversarial_critique": "Adversarial review of DEC-merge-resource-ceilings: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
