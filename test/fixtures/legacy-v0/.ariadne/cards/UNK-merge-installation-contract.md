# UNK-merge-installation-contract: Repository merge integration installation

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-30

## Statement

How should a cloned repository install and verify the local custom merge driver and non-blocking hooks without silent network execution or overwriting existing Git integration?

## Payload

```json
{
  "resolution": "Use idempotent repository-local install and doctor commands; fail closed without network fallback."
}
```
