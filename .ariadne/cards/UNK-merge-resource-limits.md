# UNK-merge-resource-limits: Merge resource limits

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Which deterministic resource limits protect the merge driver from repository-controlled oversized inputs without truncating branch knowledge?

## Payload

```json
{
  "resolution": "Use deterministic protocol hard ceilings; allow repositories only to lower them; fail without truncation."
}
```
