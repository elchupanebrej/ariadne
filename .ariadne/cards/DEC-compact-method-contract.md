# DEC-compact-method-contract: A compact contract owns normative method truth

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

A compact versioned Method Contract is the single executable normative source; designing_methodological_guides.md owns rationale and provenance, while teaching skills and the runtime reference the contract rather than duplicate its rules.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "User selected the recommended source-of-truth boundary.",
  "invariants": [
    "one normative source",
    "traceability from contract rules to guide rationale",
    "runtime code is not normative method truth"
  ],
  "adversarial_critique": [
    "Extracting a compact contract can silently change the meaning encoded by the book.",
    "The contract can become a second undocumented language that agents must learn.",
    "Every normative field must trace to guide rationale and the long guide must stop restating executable rules as competing truth."
  ]
}
```
