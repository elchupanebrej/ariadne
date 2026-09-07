# CAN-method-contract-schema-document: JSON Schema as the entire Method Contract

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Use one JSON Schema 2020-12 document as both the artifact-bundle schema and Method Contract, placing rules, verification hooks, rationale links, and lifecycle in annotations or custom extension keywords.

## Payload

```json
{
  "falsification_conditions": [
    "Required rule or verification behavior cannot be expressed without an undocumented custom extension interpreter."
  ],
  "mechanism_class": "single standard schema document with extension metadata",
  "operating_principle": "collapse contract and validation schema at one system boundary",
  "state_owner": "The JSON Schema document owns all normative fields; the guide owns linked explanation.",
  "supported_invariants": [
    "single file and digest",
    "standard artifact validation",
    "host-neutral parsing"
  ],
  "known_violated_constraints": [
    "workflow and lifecycle semantics require custom extension keywords whose execution semantics are not supplied by JSON Schema"
  ],
  "useful_effect": "Maximum reuse of a standard validator.",
  "harm": "Overloads a validation vocabulary with procedure and lifecycle semantics.",
  "change_radius": "one contract reader plus schema validators",
  "failure_modes": [
    "validators ignore annotations or extension keywords",
    "completion and rule triggers diverge across hosts"
  ],
  "required_evidence_requests": [
    "EVDREQ-method-contract-shape-prototype"
  ],
  "frame": "FRAME-methodology-skill-harness-system",
  "space": "SPACE-method-contract-shape"
}
```
