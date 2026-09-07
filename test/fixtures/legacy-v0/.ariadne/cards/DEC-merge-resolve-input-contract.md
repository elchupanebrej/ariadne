# DEC-merge-resolve-input-contract: Use two explicit reconciliation input modes

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

The atomic merge resolve command accepts exactly one mode: choose the stored base or variant by digest, or submit a schema-validated ariadne-delta that synthesizes canonical changes.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resolve-input",
  "adversarial_critique": "Adversarial review of DEC-merge-resolve-input-contract: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
