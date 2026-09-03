# OBS-merge-no-revision-binding: Evidence has no executable Git revision binding

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-30

## Statement

Current evidence schemas and gates do not bind general FACT or MEASURED claims to Git paths and content digests and do not detect claim staleness after a code merge.

## Payload

```json
{
  "source": "src/core/schemas/nodes.ts and src/gates"
}
```
