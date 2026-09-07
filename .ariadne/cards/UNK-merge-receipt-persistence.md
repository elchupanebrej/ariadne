# UNK-merge-receipt-persistence: Merge receipt persistence

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Which merge outcomes require durable graph records, and should clean or failed attempt receipts be persisted by Ariadne?

## Payload

```json
{
  "resolution": "Persist only DIVERGED contradictions; return CLEAN and FAILED receipts externally."
}
```
