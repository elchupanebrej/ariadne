# CLM-teaching-skills-clean-session-transfer: Teaching Skills enable independent clean-session transfer

- Status: UNVERIFIED
- Provenance: PROPOSED
- Type: CLM
- Revised: 2026-08-24

## Statement

Each retained Teaching Skill lets a fresh session complete one held-out faded task and one structurally changed transfer task without undeclared context, and contributes a required result that its matched source-only baseline does not provide.

## Payload

```json
{
  "dependencies": [
    "DEC-ariadne-teaching-skill-contract",
    "DEC-methodology-authoring-teaching-skill-contract",
    "DEC-harness-authoring-teaching-skill-contract"
  ],
  "falsification_conditions": [
    "any required full-arm run needs oral help, hidden input, or fails a critical criterion",
    "the matched source-only arm passes every intended teaching and transfer criterion",
    "the result cannot be reproduced twice for a tested environment combination"
  ],
  "claim_class": "Boundary contract"
}
```
