# DEC-merge-base-plus-delta-log: Write common history plus canonical semantic delta

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-03

## Statement

Serialize the merged graph as the exact common-ancestor event log followed by a minimal canonical semantic delta containing final node revisions, edge changes, tombstones, and merge contradictions.

## Payload

```json
{
  "decision_scope": "epistemic-merge-output-log",
  "adversarial_critique": "Adversarial review of DEC-merge-base-plus-delta-log: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
