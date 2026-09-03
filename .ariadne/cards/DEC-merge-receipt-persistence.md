# DEC-merge-receipt-persistence: Persist only unresolved merge knowledge

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Persist unresolved DIVERGED knowledge only through merge contradictions; return CLEAN and FAILED receipts to the caller without adding graph nodes or another merge ledger.

## Payload

```json
{
  "decision_scope": "epistemic-merge-receipt-persistence"
}
```
