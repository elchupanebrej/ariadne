# OBS-graph-last-write-wins: Current materializer replaces node revisions by ID

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

The current graph materializer applies node events with map replacement by node ID, so concatenation order selects the active revision.

## Payload

```json
{
  "source": "src/graph/storage.ts"
}
```
