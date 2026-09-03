# UNK-merge-delete-semantics: Three-way deletion semantics

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-30

## Statement

How should node removals and edge tombstones compose against unchanged, modified, or independently removed branch values?

## Payload

```json
{
  "resolution": "Treat tombstones as materialized values under standard three-way rules."
}
```
