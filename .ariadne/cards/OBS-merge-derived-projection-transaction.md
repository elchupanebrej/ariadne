# OBS-merge-derived-projection-transaction: Git merge bypasses graph projection synchronization

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

The Graph Engine transaction regenerates INDEX and cards and synchronizes graph-owned frontier fields, but Git merge drivers replace a temporary graph file outside that transaction.

## Payload

```json
{
  "source": "src/graph/storage.ts and Git custom merge-driver contract"
}
```
