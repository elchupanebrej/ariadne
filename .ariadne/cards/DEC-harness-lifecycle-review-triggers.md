# DEC-harness-lifecycle-review-triggers: Review lifecycle on decision-significant events

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Lifecycle review is triggered by normative, schema, capability, or ownership changes; new environment support claims; falsified evidence or safety violations; dependency changes outside declared compatibility; and deprecation deadlines, without an arbitrary calendar review.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-change-propagation",
    "DEC-harness-feedback-channel",
    "DEC-harness-compatibility-policy"
  ],
  "owner": "user",
  "decision_basis": "Observable events target review where a support claim can change; periodic review without a change signal adds ceremony but no evidence.",
  "invariants": [
    "every trigger routes to the affected owner",
    "a falsified support claim blocks new bundle publication or execution as appropriate",
    "review outcome is an owner receipt or version change",
    "feedback alone remains triage until it challenges an invariant or claim"
  ],
  "adversarial_critique": [
    "Event-only review may miss slow drift; add a calendar trigger only when observed stale support claims demonstrate that gap."
  ]
}
```
