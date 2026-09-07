# DEC-merge-atomic-reconciliation: Resolve merge contradictions atomically

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Reconcile through one dedicated compare-and-swap merge resolve transaction that validates the expected conflict digest, canonical changes, authorization, released quarantine, final graph, and conflict closure atomically.

## Payload

```json
{
  "decision_scope": "epistemic-merge-resolution-transaction",
  "adversarial_critique": "Adversarial review of DEC-merge-atomic-reconciliation: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
