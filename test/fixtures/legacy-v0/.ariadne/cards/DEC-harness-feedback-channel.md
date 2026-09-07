# DEC-harness-feedback-channel: Keep lifecycle feedback with owners

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Lifecycle feedback remains in owner-native issue trackers; cross-component reports begin at the bundle tracker and link to owner issues, while the harness and Tested Release Bundle store only feedback pointers.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-bundle-authority"
  ],
  "owner": "user",
  "decision_basis": "A new central feedback database would duplicate workflow ownership and add no required behavior.",
  "invariants": [
    "component owners retain triage authority",
    "cross-component status is linked rather than copied",
    "feedback capable of invalidating a support claim remains traceable to its bundle and component digest"
  ],
  "adversarial_critique": [
    "Owner-native trackers can fragment cross-component reports; the bundle issue must retain pointers to every owner issue without copying their state."
  ]
}
```
