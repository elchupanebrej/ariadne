# DEC-merge-atomic-reconciliation: Resolve merge contradictions atomically

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Reconcile through one dedicated compare-and-swap merge resolve transaction that validates the expected conflict digest, canonical changes, authorization, released quarantine, final graph, and conflict closure atomically.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resolution-transaction"
}
```
