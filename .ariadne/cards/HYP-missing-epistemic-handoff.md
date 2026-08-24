# HYP-missing-epistemic-handoff: Missing substrate contract loses Ariadne value

- Status: PROPOSED
- Provenance: PROPOSED
- Type: HYP
- Revised: 2026-08-24

## Statement

Even when Ariadne activates, the absence of a defined substrate handoff lets grill/specification/delivery work proceed without explicit facts, open unknowns, provenance, and decision frontier.

## Payload

```json
{
  "falsification_conditions": [
    "The current Ariadne output contract already requires a linked epistemic handoff before downstream skills."
  ],
  "observations": [
    "OBS-ariadne-flow-missed"
  ],
  "prediction": "A downstream skill receives a prose summary but cannot identify which questions are decision-significant or which claims remain unresolved.",
  "alternatives": [
    "HYP-narrow-root-trigger"
  ],
  "evidence_requests": [
    "EVDREQ-static-uncertainty-coverage"
  ]
}
```
