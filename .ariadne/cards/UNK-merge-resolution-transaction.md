# UNK-merge-resolution-transaction: Atomic reconciliation command

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Should reconciliation use one dedicated compare-and-swap graph transaction or a sequence of generic node and edge commands?

## Payload

```json
{
  "resolution": "Use a dedicated atomic compare-and-swap merge resolve transaction."
}
```
