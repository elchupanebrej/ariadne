# DEC-merge-conflict-identity: Use content-addressed merge contradiction incidents

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Derive a merge contradiction incident ID from conflict kind, subject, base digest, and sorted variant digests; deduplicate identical incidents and link a changed incident to the prior one with supersedes.

## Payload

```json
{
  "decision_scope": "epistemic-merge-conflict-identity"
}
```
