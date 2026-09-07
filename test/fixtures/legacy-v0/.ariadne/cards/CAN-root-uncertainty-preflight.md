# CAN-root-uncertainty-preflight: Dedicated uncertainty preflight rule

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Add a targeted rules/05-uncertainty.md preflight that confirms decision significance, records FRAME-linked unknowns/assumptions/contradictions, selects the next Ariadne operation, and emits a compact grill substrate.

## Payload

```json
{
  "falsification_conditions": [
    "The preflight cannot distinguish decision-significant uncertainty from routine doubt.",
    "The handoff fields are insufficient for grill frontier questions."
  ],
  "candidate_mechanism": "Root description points canonical uncertainty signals to a dedicated preflight rule; the rule owns substrate fields and handoff conditions.",
  "separation_principle": [
    "time"
  ],
  "hard_requirements": {
    "catches_decision_significant_uncertainty": true,
    "preserves_matt_ownership": true,
    "avoids_new_runtime_dependency": true,
    "emits_epistemic_substrate": true
  },
  "useful_effect": "Separates detection from confirmation and keeps the handoff contract in one source of truth.",
  "harms": [
    "Adds one rule file and a second-stage route.",
    "Requires a fixture set to tune false positives."
  ],
  "change_radius": "Root skill plus one uncertainty rule and rule tests.",
  "assumptions": [
    "A two-stage model-invoked route is reliable enough without a runtime classifier."
  ],
  "evidence_rung": 2
}
```
