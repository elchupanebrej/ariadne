# OBS-merge-gate-status-gap: Existing gates do not enforce merge-conflict policy

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

Current structural validation does not reject unresolved status, the semantic gate skips a contradiction in NEEDS_REVIEW, and the epistemic gate does not globally reject every unresolved merge contradiction.

## Payload

```json
{
  "source": "src/gates/semantic-gate.ts and src/gates/epistemic-gate.ts"
}
```
