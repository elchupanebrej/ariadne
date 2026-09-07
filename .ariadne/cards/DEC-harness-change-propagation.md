# DEC-harness-change-propagation: Propagate changes through owner receipts

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

A changing component owner publishes a Change Impact Receipt; every affected consumer owner must publish either a new version or a compatibility receipt bound to the new digest before a Tested Release Bundle may include the change, while unaffected components do nothing.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-bundle-authority",
    "DEC-harness-version-identity"
  ],
  "owner": "user",
  "decision_basis": "This enforces transitive review without a lockstep release train or inferred compatibility.",
  "invariants": [
    "the changing owner classifies its surface change",
    "affected consumer owners answer for their boundaries",
    "bundle assembly fails closed on missing receipts",
    "unaffected owners need not release"
  ],
  "adversarial_critique": [
    "Impact receipts can become ceremonial or omit consumers; bundle assembly must check the explicit dependency matrix and fail on missing owner responses."
  ]
}
```
