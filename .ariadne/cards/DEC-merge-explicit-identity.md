# DEC-merge-explicit-identity: Use explicit identity for deterministic conflict detection

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Deterministic merge matches ordinary nodes only by node ID and matches decisions additionally by explicit decision_scope; cross-ID semantic contradictions outside that scope are deferred to post-merge agent reasoning.

## Payload

```json
{
  "decision_scope": "epistemic-merge-semantic-identity",
  "adversarial_critique": "Adversarial review of DEC-merge-explicit-identity: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
