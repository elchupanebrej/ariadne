# CAN-cross-skill-wrapper: Cross-skill uncertainty wrapper

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Add an integration wrapper that invokes Ariadne preflight before grill-me/grill-with-docs and serializes a handoff packet at the skill boundary.

## Payload

```json
{
  "falsification_conditions": [
    "A host cannot invoke the wrapper consistently.",
    "Generic uncertain tasks still bypass Ariadne.",
    "Adapter logic duplicates the root trigger."
  ],
  "candidate_mechanism": "A host-level adapter intercepts explicit grill requests, runs Ariadne, and forwards cards plus frontier summary.",
  "separation_principle": [
    "system boundary"
  ],
  "hard_requirements": {
    "catches_decision_significant_uncertainty": true,
    "preserves_matt_ownership": true,
    "avoids_new_runtime_dependency": true,
    "emits_epistemic_substrate": true
  },
  "useful_effect": "Makes explicit grill handoff deterministic when the host supports adapters.",
  "harms": [
    "Couples Ariadne to Matt skill invocation details.",
    "Does not cover uncertainty tasks that do not request grill.",
    "May not exist on all hosts."
  ],
  "change_radius": "Host integration, skill adapter, and cross-skill tests.",
  "assumptions": [
    "The host exposes a stable hook before user-invoked skills."
  ],
  "evidence_rung": 1
}
```
