# CAN-merge-materialized-variants: Materialized variants with Git-backed history

- Status: RESOLVED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-30

## Statement

Store each incompatible materialized branch variant in a graph-native contradiction and rely on referenced Git commits for raw event history.

## Payload

```json
{
  "mechanism_class": "graph-native multi-variant conflict record",
  "separation_principle": "State/Data",
  "state_owner": "Epistemic Graph Engine",
  "known_harm": "Reconciliation needs Git history to inspect intermediate branch events",
  "selection_status": "SELECTED"
}
```
