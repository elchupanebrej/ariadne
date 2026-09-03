# DEC-merge-resolve-input-contract: Use two explicit reconciliation input modes

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

The atomic merge resolve command accepts exactly one mode: choose the stored base or variant by digest, or submit a schema-validated ariadne-delta that synthesizes canonical changes.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resolve-input"
}
```
