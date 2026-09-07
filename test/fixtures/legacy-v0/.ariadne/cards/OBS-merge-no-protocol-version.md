# OBS-merge-no-protocol-version: No merge protocol version exists

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-30

## Statement

Current graph state has an optional schema_version and the CLI has a package version, but no independent merge protocol or merge contradiction payload version exists.

## Payload

```json
{
  "source": "src/graph/storage.ts and src/cli/index.ts"
}
```
