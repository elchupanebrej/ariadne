# DEC-method-contract-shape: The Method Contract is one typed JSON manifest

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

The compact Method Contract is one UTF-8 JSON manifest with a closed method-contract/1 envelope and embedded JSON Schema 2020-12 fragments for artifact and condition matching; it contains concise normative records and stable pointers, while the long guide retains explanation, examples, evidence synthesis, and provenance.

## Payload

```json
{
  "owner": "method owner",
  "decision_basis": "VAL-SELECT-method-contract-shape passed the non-compensatory filter and VAL-method-contract-shape supported the selected representation at Rung 3.",
  "candidate": "CAN-method-contract-embedded-manifest",
  "evidence": [
    "EVD-method-contract-shape-prototype",
    "VAL-method-contract-shape"
  ],
  "representation": {
    "media_type": "application/json",
    "format": "method-contract/1",
    "atomicity": "one exact stored file is pinned by version and byte digest",
    "schema_dialect": "JSON Schema 2020-12 for artifact shapes and all when/complete_when predicates",
    "format_validation": "a host-neutral v1 meta-schema validates the closed envelope; the meta-schema defines the format, not the method's normative content"
  },
  "top_level_sections": [
    "format",
    "id",
    "version",
    "status",
    "guide",
    "artifacts",
    "rules",
    "completion_profiles",
    "verification_hooks",
    "lifecycle"
  ],
  "identity_fields": {
    "format": "contract envelope compatibility identifier",
    "id": "stable method identifier",
    "version": "normative method version",
    "status": "draft, active, deprecated, or retired",
    "guide": "rationale-and-provenance document reference"
  },
  "artifact_contract": {
    "records": [
      "A0",
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
      "A7"
    ],
    "each_record": [
      "id",
      "role",
      "schema",
      "rationale_ref"
    ],
    "A0_required_decisions": [
      "user_and_situation",
      "action",
      "learning_path",
      "verification",
      "rationale_and_unknowns",
      "next_step"
    ],
    "A1_required_decisions": [
      "problem",
      "desired_outcome",
      "target_capability",
      "scope",
      "priority",
      "success_metrics",
      "assumptions_and_constraints"
    ],
    "A2_required_decisions": [
      "claim records with K type, E class, provenance, relevance, confidence, inference-to-recommendation link, counterconditions, normative assumptions, and review trigger"
    ],
    "A3_required_decisions": [
      "roles and authority",
      "prior knowledge",
      "real tasks",
      "work context",
      "resources and constraints",
      "accessibility and equity",
      "user participation"
    ],
    "A4_required_decisions": [
      "rule cards using the seven-part executable form"
    ],
    "A5_required_decisions": [
      "meaningful task",
      "complete worked example",
      "decision model and rationale",
      "self-explanation",
      "incomplete example",
      "independent task",
      "transfer or error case"
    ],
    "A6_required_decisions": [
      "hypotheses",
      "pilot",
      "expert review",
      "user test",
      "transfer test",
      "implementation observation",
      "data-driven decisions and self-consistency receipts when applicable"
    ],
    "A7_required_decisions": [
      "ownership and rights",
      "version",
      "review triggers",
      "feedback channel",
      "deviations",
      "distribution",
      "semantic history and retirement"
    ]
  },
  "rule_contract": {
    "required_fields": [
      "id",
      "trigger",
      "inputs",
      "action",
      "branches",
      "output",
      "recovery",
      "escalation",
      "rationale_ref"
    ],
    "predicate_shape": {
      "target": "named context, artifact, receipt, or bundle subject",
      "schema": "embedded JSON Schema fragment evaluated against that subject"
    },
    "closed_effects": [
      "require_artifact",
      "require_receipt",
      "emit_receipt",
      "select_rule",
      "stop"
    ],
    "action_semantics": "Concise normative agent instructions live in the rule record; generic orchestration evaluates only typed obligations, outputs, stops, schemas, and owner receipts.",
    "prohibitions": [
      "no host-language callback",
      "no arbitrary expression language",
      "no guide paragraph copied as rationale"
    ]
  },
  "expansion_rules": {
    "A1": "purpose is vague or expanding",
    "A2": "rules are disputed or rationales conflict",
    "A3": "roles, tasks, or constraints differ",
    "A4": "branching, exceptions, or recovery appear",
    "A5": "one example is insufficient for transfer",
    "A6": "repeatable tests or metrics are needed",
    "A7": "owners, versions, or coordinated changes appear",
    "behavior": "A0 remains the concise current map and points to every expanded artifact."
  },
  "completion_profiles": {
    "pilot": "schema-valid A0, all triggered obligations satisfied, no unresolved stop",
    "working": "schema-valid A0 plus every A1-A7 artifact triggered by observable expansion signals",
    "evidence_focused": "schema-valid A0 and A1-A7, traceability and audit receipts, external-verification receipt, all pins matching",
    "metamethodological": "evidence-focused completion plus 49-item audit, leave-one-out, F(M) equivalence, change-propagation, and no-circular-validation receipts; self-consistency never satisfies external verification"
  },
  "verification_hooks": {
    "record_shape": [
      "id",
      "on",
      "check",
      "owner",
      "required_receipt",
      "rationale_ref"
    ],
    "events": [
      "contract.load",
      "artifact.changed",
      "context.changed",
      "before.complete",
      "before.publish"
    ],
    "closed_checks": [
      "contract_meta_schema",
      "artifact_schema",
      "rule_triggers",
      "rationale_link_resolution",
      "completion_profile",
      "version_and_digest_pins",
      "owner_receipt"
    ],
    "execution_boundary": "Hooks name checks and receipt owners; they do not embed scripts or move owner semantics into the orchestration kernel."
  },
  "lifecycle_metadata": [
    "owner",
    "decision_rights",
    "version",
    "status",
    "effective_at",
    "supersedes",
    "compatibility",
    "review_triggers",
    "feedback_ref",
    "change_log",
    "retirement"
  ],
  "lifecycle_boundary": "Ticket 12 will decide compatibility, migration, review, and retirement semantics; v1 reserves and requires their typed locations without pre-empting that policy.",
  "failure_behavior": [
    "reject unsupported format or schema dialect",
    "reject malformed contract, artifact, rule, hook, or lifecycle record",
    "stop on unresolved required artifact, receipt, human decision, approval, rationale pointer, version pin, or ambiguous effect",
    "never infer completion from prose or self-consistency alone"
  ],
  "generated_views": "Human-readable tables, per-artifact schemas, examples, and adapter types may be generated from the manifest but are non-normative and must carry the source version and digest.",
  "reopen_condition": "A required normative decision cannot be represented by the closed record types without arbitrary computation, the single file becomes measurably unusable, or a production contract test shows divergent interpretation across eligible hosts.",
  "adversarial_critique": [
    "The envelope must not grow into a second workflow language; new effect kinds require a format-version decision.",
    "Embedded schemas may be verbose; split only after measured readability or ownership failure, never speculatively.",
    "Resolvable links prove traceability structure, not semantic equivalence between guide rationale and contract rule.",
    "Rung 3 validates the representation logic only; Rung 6 remains required for adapter compatibility and clean-session completion."
  ]
}
```
