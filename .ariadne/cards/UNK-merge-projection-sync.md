# UNK-merge-projection-sync: Derived projection synchronization

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

How are derived indexes, cards, and graph-owned state projections kept consistent when Git invokes a file-level merge driver outside the Graph Engine transaction?

## Payload

```json
{
  "resolution": "Use generated-file merge behavior plus non-blocking hook sync and an explicit repair path."
}
```
