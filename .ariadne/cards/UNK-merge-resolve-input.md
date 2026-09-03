# UNK-merge-resolve-input: Reconciliation input contract

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-30

## Statement

Which explicit input forms may the atomic merge resolve command accept for choosing an existing variant or synthesizing a canonical model?

## Payload

```json
{
  "resolution": "Accept exactly one of stored-variant selection by digest or a schema-validated ariadne-delta."
}
```
