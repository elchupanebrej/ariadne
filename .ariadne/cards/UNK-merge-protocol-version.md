# UNK-merge-protocol-version: Merge protocol versioning

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

How does a repository pin a deterministic merge protocol and conflict payload schema independently of the package release version?

## Payload

```json
{
  "resolution": "Use merge_protocol_version 1 independently of package releases and reject incompatible CLIs."
}
```
