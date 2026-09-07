# DEC-merge-receipt-persistence: Persist only unresolved merge knowledge

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Persist unresolved DIVERGED knowledge only through merge contradictions; return CLEAN and FAILED receipts to the caller without adding graph nodes or another merge ledger.

## Payload

```json
{
  "decision_scope": "epistemic-merge-receipt-persistence",
  "adversarial_critique": "Adversarial review of DEC-merge-receipt-persistence: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
