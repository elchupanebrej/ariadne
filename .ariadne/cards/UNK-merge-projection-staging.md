# UNK-merge-projection-staging: Projection staging boundary

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Which regenerated projection changes may a hook stage automatically without accidentally staging host-owned STATE metadata?

## Payload

```json
{
  "resolution": "Stage only fully derived index and cards; update but do not stage STATE."
}
```
