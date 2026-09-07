# UNK-uncertainty-trigger-boundary: Uncertainty trigger boundary

- Status: OPEN
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Which observable task signals are sufficient to activate Ariadne before downstream work?

## Payload

```json
{
  "falsification_conditions": [
    "A trigger policy cannot distinguish a design unknown from a routine factual question."
  ],
  "question": "Should the signal be limited to decision-significant uncertainty or include every expression of doubt?",
  "possible_outcomes": [
    "Canonical decision-significant uncertainty signals activate Ariadne.",
    "Any subjective uncertainty activates Ariadne and increases false positives."
  ],
  "affected_candidates": [
    "CAN-root-uncertainty-vocabulary",
    "CAN-root-uncertainty-preflight",
    "CAN-cross-skill-wrapper"
  ],
  "owner": "Ariadne root skill maintainer",
  "decision_deadline": "Before changing the root trigger contract"
}
```
