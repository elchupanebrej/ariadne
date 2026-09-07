# DEC-merge-topology-divergence: Treat combined topology violations as divergence

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

When individually valid branch models form an invalid topology only in combination, quarantine the conflicting semantic changes in a graph-native merge contradiction and complete Git merge with DIVERGED; malformed individual inputs remain FAILED.

## Payload

```json
{
  "decision_scope": "epistemic-merge-topology-policy",
  "adversarial_critique": "Adversarial review of DEC-merge-topology-divergence: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
