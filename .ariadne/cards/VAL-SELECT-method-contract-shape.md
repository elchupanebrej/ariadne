# VAL-SELECT-method-contract-shape: Select the compact Method Contract representation

- Status: SELECTED
- Provenance: DERIVED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select one JSON Method Contract manifest with a closed v1 envelope and embedded JSON Schema 2020-12 fragments for artifact and trigger predicates; reject the all-schema document and multi-file bundle.

## Payload

```json
{
  "hard_requirements": [
    "one normative source with one version and exact-file digest",
    "readable without the long guide for execution",
    "deterministic host-neutral artifact and trigger evaluation",
    "stable A0 and A1-A7, rule, completion, check, rationale, and lifecycle identifiers",
    "no prose parser, arbitrary executable callbacks, or duplicated rationale",
    "fail closed on unsupported format, invalid schema, unresolved obligation, or missing receipt"
  ],
  "candidate_results": {
    "CAN-method-contract-schema-document": {
      "result": "FAIL",
      "failed_requirements": [
        "deterministic procedure and lifecycle evaluation without custom executable extension semantics"
      ],
      "observation": "JSON Schema validates data but does not itself define procedure, verification events, or lifecycle actions."
    },
    "CAN-method-contract-embedded-manifest": {
      "result": "PASS",
      "failed_requirements": [],
      "observation": "A closed manifest envelope separates concise normative records while reusing JSON Schema only for predicates and artifact shapes."
    },
    "CAN-method-contract-module-bundle": {
      "result": "FAIL",
      "failed_requirements": [
        "one atomic normative artifact",
        "smallest representation"
      ],
      "observation": "A lock manifest can pin modules but adds digest-tree, partial-publication, and mixed-version states with no demonstrated need."
    }
  },
  "preference_criteria": {
    "useful_effect": "The selected manifest is simultaneously agent-readable, schema-validatable, content-addressable, and explicit about ownership boundaries.",
    "mechanism_cost": "One v1 meta-schema and generic evaluator; no general expression language.",
    "code_and_mutable_state_cost": "No contract-owned runtime state; exact bytes plus digest are immutable input.",
    "infrastructure_cost": "One repository file; no service, database, compiler, or package manager.",
    "operational_harm": "Embedded schemas can be verbose but remain local and deterministic.",
    "cognitive_load": "Nine top-level sections and repeated closed record shapes; rationale stays in linked guide anchors.",
    "change_radius": "Method Contract reader, teaching skill references, completion gates, and lifecycle checks."
  },
  "provenance": [
    "DEC-compact-method-contract",
    "EVD-method-contract-shape-prototype",
    "docs/designing_methodological_guides.md"
  ],
  "evidence_rung": 3,
  "assumptions": [
    "A v1 closed obligation vocabulary can cover the guide's normative operations without arbitrary computation.",
    "Exact-file byte hashing is sufficient for immutable pinning; canonicalization is not required to identify a stored artifact."
  ],
  "unknowns": [
    "The final compatibility and migration policy is owned by lifecycle ticket 12.",
    "The production validator and clean-session fixtures are owned by later implementation and verification tickets."
  ],
  "adversarial_critique": [
    {
      "attack": "The manifest becomes a hidden workflow language.",
      "response": "Limit v1 to JSON Schema matchers plus closed obligation, receipt, stop, and rule-selection records; adding an effect kind is a contract-format change."
    },
    {
      "attack": "Embedded schemas make the compact contract unreadable.",
      "response": "Keep only required decision slots and structural constraints; descriptions, examples, evidence synthesis, and source quotations remain in guide anchors."
    },
    {
      "attack": "The guide and contract silently drift.",
      "response": "Every normative record requires a resolvable rationale_ref and lifecycle changes require traceability and self-consistency hooks; the contract remains the only executable truth."
    },
    {
      "attack": "Self-consistency can masquerade as external validation.",
      "response": "Completion profiles require separate external-verification and self-consistency receipts; neither satisfies the other."
    },
    {
      "attack": "A single file prevents modular reuse.",
      "response": "Generated views and schemas may be derived, but become normative only through the pinned manifest; split only after measured size or ownership pressure."
    }
  ],
  "selection": "CAN-method-contract-embedded-manifest",
  "rejection_reasons": {
    "CAN-method-contract-schema-document": "failed hard procedure-semantics boundary",
    "CAN-method-contract-module-bundle": "failed hard atomicity and minimality boundaries"
  },
  "next_evidence_requests": [
    "ticket 11 clean-session contract fixtures",
    "ticket 12 version compatibility and retirement policy"
  ]
}
```
