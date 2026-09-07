# UNK-merge-evidence-freshness: Post-merge evidence freshness

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

What should post-merge integration do with FACT and MEASURED claims when code changed but current evidence nodes have no executable repository revision binding?

## Payload

```json
{
  "resolution": "Preserve provenance and emit POST_MERGE_VERIFICATION_REQUIRED when non-graph files changed."
}
```
