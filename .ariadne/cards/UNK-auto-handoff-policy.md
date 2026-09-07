# UNK-auto-handoff-policy: Automatic grill handoff policy

- Status: OPEN
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-09-07

## Statement

Whether Ariadne should automatically prepare a substrate whenever grill-me/grill-with-docs is requested, while leaving to-spec, to-tickets, and implement human-controlled.

## Payload

```json
{
  "falsification_conditions": [
    "A grill request reaches interview without the required epistemic context."
  ],
  "question": "Should an explicit grill request force an Ariadne preflight?",
  "possible_outcomes": [
    "Explicit grill requests run Ariadne preflight first.",
    "Grill starts directly and Ariadne only runs when separately requested."
  ],
  "affected_candidates": [
    "CAN-root-uncertainty-preflight",
    "CAN-cross-skill-wrapper"
  ],
  "owner": "Workflow owner",
  "decision_deadline": "Before changing skill handoff rules"
}
```
