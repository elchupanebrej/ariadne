# DEC-merge-explicit-identity: Use explicit identity for deterministic conflict detection

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

Deterministic merge matches ordinary nodes only by node ID and matches decisions additionally by explicit decision_scope; cross-ID semantic contradictions outside that scope are deferred to post-merge agent reasoning.

## Payload

```json
{
  "decision_scope": "epistemic-merge-semantic-identity"
}
```
