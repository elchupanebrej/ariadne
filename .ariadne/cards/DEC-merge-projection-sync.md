# DEC-merge-projection-sync: Synchronize generated projections after graph merge

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Treat index and cards as generated merge outputs, accept a temporary current-side projection during Git merge, and run non-blocking projection synchronization from merge and commit hooks with an explicit repair command when hooks are absent.

## Payload

```json
{
  "decision_scope": "epistemic-merge-projection-sync",
  "adversarial_critique": "Adversarial review of DEC-merge-projection-sync: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
