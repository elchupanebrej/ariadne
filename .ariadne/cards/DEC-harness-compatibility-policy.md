# DEC-harness-compatibility-policy: Support exact tested bundle tuples

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Harness execution supports only exact component version-and-digest tuples published in active or explicitly deprecated Tested Release Bundles; ranges and capability declarations select tests but never authorize execution, and direct use remains governed by each owner.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-release-topology",
    "DEC-harness-version-identity"
  ],
  "owner": "user",
  "decision_basis": "Exact tuples preserve auditability and fail-closed dispatch without constraining direct owner tools.",
  "invariants": [
    "unsupported tuples fail before dispatch",
    "a range match is not a compatibility receipt",
    "deprecated support is explicit and bounded",
    "direct Matt and Ariadne use does not require a bundle"
  ],
  "adversarial_critique": [
    "Exact tuples can multiply support state; only active and bounded deprecated bundles remain executable."
  ]
}
```
