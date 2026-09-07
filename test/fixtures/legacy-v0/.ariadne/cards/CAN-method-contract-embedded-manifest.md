# CAN-method-contract-embedded-manifest: Single manifest with embedded standard schemas

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Use one canonical JSON manifest with a fixed Method Contract envelope; embed JSON Schema 2020-12 fragments for artifact shapes and rule conditions, while representing obligations, checks, rationale pointers, completion gates, and lifecycle as closed typed records.

## Payload

```json
{
  "falsification_conditions": [
    "A required guide decision needs arbitrary computation or cannot be represented as a closed rule record plus JSON Schema predicate."
  ],
  "mechanism_class": "single typed contract manifest with embedded standard schema predicates",
  "operating_principle": "separate normative record kinds by data while keeping one atomic file and digest",
  "state_owner": "The manifest owns concise normative decisions and identifiers; standard schema fragments own data predicates; the guide owns linked rationale; verification providers own receipts.",
  "supported_invariants": [
    "single file and digest",
    "no prose parser or host-language callbacks",
    "standard artifact and trigger predicates",
    "explicit separation of rule, completion, verification, rationale, and lifecycle records",
    "host-neutral fail-closed evaluation"
  ],
  "known_violated_constraints": [],
  "useful_effect": "Keeps the contract readable and executable without inventing a general expression language.",
  "harm": "Requires a small versioned envelope validator and closed obligation vocabulary.",
  "change_radius": "one contract meta-schema and generic reader",
  "failure_modes": [
    "envelope vocabulary grows into a workflow language",
    "embedded schemas become verbose",
    "implementation copies linked rationale"
  ],
  "required_evidence_requests": [
    "EVDREQ-method-contract-shape-prototype"
  ],
  "frame": "FRAME-methodology-skill-harness-system",
  "space": "SPACE-method-contract-shape"
}
```
