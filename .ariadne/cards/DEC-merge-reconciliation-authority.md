# DEC-merge-reconciliation-authority: Separate agent reconciliation from decision authority

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-30

## Statement

An agent may reconcile non-decision merge contradictions when normal validation and evidence rules pass, but changing or replacing locked decisions requires decision-owner authorization.

## Payload

```json
{
  "decision_scope": "epistemic-merge-reconciliation-authority"
}
```
