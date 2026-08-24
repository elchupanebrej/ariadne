# DEC-harness-bundle-authority: Owner-gated bundle publication

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Component owners alone publish their versions and compatibility declarations; the harness repository maintainer may publish a Tested Release Bundle only after every included owner declaration and required evidence receipt passes, with no waiver or reinterpretation authority.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-release-topology"
  ],
  "owner": "user",
  "decision_basis": "Preserves existing domain authority while assigning the derived assembly artifact one accountable publisher.",
  "invariants": [
    "bundle assembler cannot publish component versions",
    "bundle assembler cannot waive a failed owner declaration or evidence gate",
    "bundle contains pointers and pins rather than copied owner semantics"
  ],
  "adversarial_critique": [
    "The bundle maintainer can become a coordination bottleneck; it may reject incomplete evidence but cannot reinterpret or waive owner declarations."
  ]
}
```
