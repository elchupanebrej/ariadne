# CAN-merge-event-suffixes: Complete event suffix quarantine

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Store complete incompatible branch event suffixes inside a graph-native contradiction until reconciliation releases a valid canonical sequence.

## Payload

```json
{
  "mechanism_class": "event-sourced quarantine",
  "separation_principle": "Time",
  "state_owner": "Epistemic Graph Engine",
  "known_harm": "Duplicates history already retained by Git and expands conflict payloads",
  "rejection_reason": "Duplicates event history retained by Git."
}
```
