# DEC-uncertainty-interaction-contract: Decide uncertainty-first Ariadne interaction

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Ariadne is the uncertainty ingress and epistemic substrate provider. It activates for decision-significant uncertainty, runs a targeted preflight, records linked epistemic cards, and gives grill-me/grill-with-docs a frontier summary with inline artifact links. The user-confirmed policy keeps to-spec, to-tickets, and implement human-controlled.

## Payload

```json
{
  "owner": "Human user",
  "decision_basis": [
    "VAL-SELECT-uncertainty-ingress",
    "EVD-static-uncertainty-coverage",
    "User-confirmed recommended answers"
  ],
  "candidate_ref": "CAN-root-uncertainty-preflight",
  "evidence_refs": [
    "EVD-static-uncertainty-coverage"
  ],
  "unresolved_risks": [
    "UNK-uncertainty-trigger-boundary",
    "UNK-grill-handoff-shape",
    "UNK-auto-handoff-policy"
  ],
  "adversarial_critique": "The preflight keeps the substrate in Ariadne, avoids host-specific wrapper coupling, and preserves downstream ownership. Fixture validation must still falsify false-positive activation, incomplete handoff, and accidental delivery-skill auto-invocation.",
  "rollback_condition": "If fixture evidence shows unacceptable false positives or grill cannot reconstruct the frontier, reopen this decision and revise the trigger or substrate contract.",
  "user_confirmation": "All three recommendations confirmed by the user."
}
```
