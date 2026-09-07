# VAL-method-contract-shape: Validate the compact Method Contract representation

- Status: SUPPORTED
- Provenance: MEASURED
- Type: VAL
- Revised: 2026-09-07

## Statement

The single typed JSON manifest candidate satisfies the representation claim at Rung 3 for the seven specified design scenarios; this validates the contract shape, not production adapter compatibility or fresh-session effectiveness.

## Payload

```json
{
  "verdict": "SUPPORTED",
  "claim": "CAN-method-contract-embedded-manifest",
  "claim_class": "Contract representation and algorithmic gating logic",
  "required_invariants": {
    "one_atomic_artifact": "PASS",
    "standard_machine_predicates": "PASS",
    "conditional_A0_to_A1_A7_obligations": "PASS",
    "separate_external_and_self_consistency_receipts": "PASS",
    "unsupported_version_fails_closed": "PASS",
    "missing_rationale_fails_closed": "PASS",
    "no_general_expression_language": "PASS"
  },
  "minimum_rung": 3,
  "actual_rung": 3,
  "evidence": "EVD-method-contract-shape-prototype",
  "falsification_results": {
    "schema_document": "FALSIFIED for this requirement set because procedure and lifecycle need custom executable extensions",
    "embedded_manifest": "SUPPORTED for the tested shape",
    "module_bundle": "FALSIFIED as the smallest atomic representation"
  },
  "command": "Extract #logic from .scratch/methodological-harness-system/prototypes/04-method-contract-shape.throwaway.html with Node vm; assert seven outcomes and one eligible candidate.",
  "environment": "Local Node.js; pure synthetic data; no persistence.",
  "limitations": [
    "No production JSON Schema validator or adapter boundary was exercised.",
    "No clean-session user or agent was tested.",
    "Lifecycle compatibility semantics remain downstream."
  ]
}
```
