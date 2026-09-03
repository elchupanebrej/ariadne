# DEC-merge-postmerge-verification: Require explicit post-merge evidence verification

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Never change provenance solely because of merge; when non-graph files change, emit POST_MERGE_VERIFICATION_REQUIRED in the receipt because general evidence revision binding does not yet exist.

## Payload

```json
{
  "decision_scope": "epistemic-merge-evidence-freshness"
}
```
