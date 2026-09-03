# OBS-merge-no-staging: Projection regeneration has no Git staging contract

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-30

## Statement

Current GraphStorage regenerates INDEX and cards and synchronizes graph-owned STATE fields during graph transactions, but regenerateIndex does not sync STATE and no Ariadne command stages Git files.

## Payload

```json
{
  "source": "src/graph/storage.ts"
}
```
