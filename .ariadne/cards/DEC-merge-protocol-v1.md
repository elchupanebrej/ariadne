# DEC-merge-protocol-v1: Version the merge protocol independently

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Define merge_protocol_version 1 independently of the package version, include it in the driver identity, merge contradictions, and receipts, and make the doctor reject an incompatible installed CLI.

## Payload

```json
{
  "decision_scope": "epistemic-merge-protocol-version",
  "adversarial_critique": "Adversarial review of DEC-merge-protocol-v1: revisit this decision if a supported merge scenario falsifies its stated contract or violates the merge invariants for preservation, authority, or deterministic resolution."
}
```
