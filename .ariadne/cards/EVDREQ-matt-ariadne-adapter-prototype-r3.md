# EVDREQ-matt-ariadne-adapter-prototype-r3: Prototype the Matt and Ariadne adapter state contract

- Status: OPEN
- Provenance: PROPOSED
- Type: EVDREQ
- Revised: 2026-09-07

## Statement

Drive deterministic happy-path, HITL, direct-use import, cancellation, ambiguous-effect, invalid-receipt, unsupported-capability, and shadow-state cases through the proposed pointer-only adapter reducer.

## Payload

```json
{
  "claim": "CAN-pointer-only-matt-ariadne-adapters",
  "candidate": "CAN-pointer-only-matt-ariadne-adapters",
  "claim_class": "Algorithmic logic",
  "minimum_rung": 3,
  "pass_condition": "Every valid path advances using pinned owner pointers and every cancellation, ambiguity, invalid receipt, unsupported capability, or copied semantic payload stops without duplicate owner state.",
  "fail_condition": "Any invalid path succeeds, a valid direct-use handoff is impossible, or the reducer must interpret Matt workflow or Ariadne epistemic payloads.",
  "providers": [
    "Decide the Matt Pocock Skills and Ariadne adapter contracts"
  ],
  "method": "Self-contained deterministic logic prototype",
  "environment": "Static HTML with pure JavaScript reducer; no external services"
}
```
