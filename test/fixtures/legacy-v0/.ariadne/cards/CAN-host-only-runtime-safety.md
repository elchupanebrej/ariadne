# CAN-host-only-runtime-safety: Ungated host-only runtime safety

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Store correlation pointers only and delegate authorization, duplicate suppression, recovery, event ordering, and retry semantics entirely to each host without one generic attempt gate.

## Payload

```json
{
  "falsification_conditions": [
    "A clean-session host-native baseline implements the selected generic contract without hidden memory or a distinct harness layer"
  ],
  "mechanism_class": "unreceipted host delegation",
  "separation_principle": "System Boundary",
  "state_owner": "each host",
  "supported_invariants": [
    "minimal harness code",
    "host-native enforcement"
  ],
  "known_violations": [
    "deterministic cross-host fresh-session recovery",
    "one host-neutral failure contract",
    "generic replay and event-order gates"
  ]
}
```
