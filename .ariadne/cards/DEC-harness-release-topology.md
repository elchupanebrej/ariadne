# DEC-harness-release-topology: Use independent versions with tested release bundles

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Method Contract, teaching skills, adapters, kernel, examples, and receipts keep owner-controlled versions; a derived immutable release bundle pins one tested version and digest of each required component without becoming normative truth.

## Payload

```json
{
  "dependencies": [
    "VAL-SELECT-harness-lifecycle-topology"
  ],
  "owner": "user",
  "decision_basis": "Only the tested-bundle candidate preserves separate authority, exact reproducibility, fail-closed dispatch, and direct owner use.",
  "invariants": [
    "bundle content is pointer-only and non-normative",
    "component owners alone publish component versions and compatibility declarations",
    "every orchestration and clean-session run pins an exact bundle or exact equivalent component set"
  ],
  "adversarial_critique": [
    "A tested bundle can become a shadow release train; constrain it to exact pins and owner receipts."
  ]
}
```
