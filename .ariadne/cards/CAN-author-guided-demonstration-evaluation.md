# CAN-author-guided-demonstration-evaluation: Author-guided demonstration evaluation

- Status: REJECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Let the methodology author guide a session through the worked examples and judge whether the resulting artifacts appear correct.

## Payload

```json
{
  "mechanism_class": "guided demonstration and narrative review",
  "state_owner": "method author",
  "supported_invariants": [
    "fast feedback on example clarity"
  ],
  "known_violations": [
    "absence of hidden author context",
    "independent transfer",
    "reproducible input boundary",
    "blinded evaluation",
    "matched deletion baseline"
  ]
}
```
