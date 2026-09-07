# UNK-recursive-self-application-topology: Self-application topology

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

How should methodology-authoring and harness-authoring apply to each other without creating circular runtime ownership, versioning, or validation?

## Payload

```json
{
  "outcomes": [
    {
      "value": "staged build-time bootstrap and fixed-point check",
      "effect": "selected; recursive authoring with acyclic runtime dependencies"
    },
    {
      "value": "mutual runtime invocation",
      "effect": "not selected"
    },
    {
      "value": "independent duplicated packages",
      "effect": "not selected"
    }
  ],
  "owner": "user",
  "resolved_by": "DEC-staged-self-application",
  "resolution": "staged bootstrap followed by self-application and F(M) equivalence check"
}
```
