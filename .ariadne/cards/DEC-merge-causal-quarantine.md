# DEC-merge-causal-quarantine: Quarantine the causal branch-change closure

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Quarantine only branch-added or branch-modified materialized values in the transitive causal influence closure of a conflict, using deductive, support, invalidation, and node dependency relations but not non-causal references.

## Payload

```json
{
  "decision_scope": "epistemic-merge-quarantine-closure",
  "adversarial_critique": "Adversarial review of DEC-merge-causal-quarantine: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
