# DEC-methodological-harness-lifecycle: Federated methodological harness lifecycle

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Method Contract, Teaching Skills, adapters, kernel, worked examples, and receipts keep owner-controlled versions and lifecycle authority, while immutable Tested Release Bundles pin exact supported tuples and owner evidence; change propagation, migration, and retirement remain owner-gated and fail closed.

## Payload

```json
{
  "dependencies": [
    "DEC-harness-release-topology",
    "DEC-harness-bundle-authority",
    "DEC-harness-version-identity",
    "DEC-harness-change-propagation",
    "DEC-harness-compatibility-policy",
    "DEC-harness-feedback-channel",
    "DEC-harness-lifecycle-review-triggers",
    "DEC-harness-bundle-migration",
    "DEC-harness-bundle-retirement",
    "DEP-harness-lifecycle-propagation"
  ],
  "owner": "user",
  "decision_basis": "The user confirmed the complete four-round design tree; the selected policy preserves separate ownership, reproducibility, direct use, bounded migration, and executable retirement without a central release train.",
  "hard_requirements": [
    "separate component ownership",
    "exact reproducible pins",
    "no shadow normative or owner state",
    "direct Matt and Ariadne use",
    "fail-closed unsupported combinations",
    "pin-preserving migration",
    "executable retirement"
  ],
  "lifecycle": {
    "component": "owner-defined publish, deprecate, retire policy",
    "bundle": [
      "draft",
      "active",
      "deprecated",
      "retired"
    ],
    "attempt": "remains pinned to its starting bundle"
  },
  "adversarial_critique": [
    "A tested bundle may become a central source of truth; it is restricted to pins and owner evidence.",
    "Exact tuples may multiply; only active and bounded deprecated bundles remain executable.",
    "Drain-only migration may strand work; owner-approved terminal receipts and new attempts handle non-drainable cases without mutating history.",
    "Absence checks cannot discover undeclared external direct users; retirement claims are bounded to registered bundle consumers and attempts, while direct-use support remains owner-defined."
  ],
  "evidence_boundary": "Structurally decided; real owner boundary compatibility remains subject to existing Rung 6 clean-session conformance and Rung 8 recovery evidence."
}
```
