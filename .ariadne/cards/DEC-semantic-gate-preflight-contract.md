# DEC-semantic-gate-preflight-contract: Semantic-gate preflight contract

- Status: ACTIVE
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Use a pure candidate-breadth preflight helper invoked by the CLI before the strict semantic gate; report all four canonical separation principles with the active depth-mode threshold, covered principles, uncovered principles, and additional principles needed.

## Payload

```json
{
  "falsification_conditions": [
    "Any graph that passes the strict gate but is flagged by preflight, or vice versa, reopens this decision."
  ],
  "owner": "Human user",
  "decision_basis": [
    "FRAME-semantic-gate-preflight-diagnostics",
    "UNK-semantic-preflight-placement",
    "UNK-semantic-principle-contract",
    "/mnt/c/Users/bulky/Projects/ariadne/docs/adr/0006-contradiction-resolution-via-separation-principles.md"
  ],
  "user_confirmation": "User confirmed both recommended answers.",
  "preserved_invariants": [
    "Preflight is read-only",
    "The hard semantic gate remains strict",
    "A completed three-candidate graph still passes",
    "No exact trio is hard-coded"
  ],
  "adversarial_critique": [
    {
      "attack": "A read-only preflight beside the strict gate could drift from gate rules and report stale or contradictory breadth guidance.",
      "response": "The helper is pure and derives thresholds and principles from the same constants as the gate; the strict gate remains authoritative and blocking."
    },
    {
      "attack": "Callers might treat preflight output as a license to skip the strict gate.",
      "response": "Preflight is diagnostic-only by contract; preserved invariants keep a completed three-candidate graph passing, so preflight cannot false-positive on valid graphs."
    }
  ]
}
```
