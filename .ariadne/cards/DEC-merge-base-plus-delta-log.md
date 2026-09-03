# DEC-merge-base-plus-delta-log: Write common history plus canonical semantic delta

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Serialize the merged graph as the exact common-ancestor event log followed by a minimal canonical semantic delta containing final node revisions, edge changes, tombstones, and merge contradictions.

## Payload

```json
{
  "decision_scope": "epistemic-merge-output-log"
}
```
