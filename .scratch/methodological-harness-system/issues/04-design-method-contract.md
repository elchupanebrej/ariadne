# Design the compact Method Contract

Type: prototype
Status: resolved
Blocked by: None
Parent: [Methodological Harness System](../map.md)

## Question

What is the smallest readable and executable versioned Method Contract that represents the guide's A0 and A1–A7 decisions, rule triggers, artifact schemas, completion criteria, verification hooks, rationale links, and lifecycle metadata without duplicating the long guide?

## Comments

- A throwaway logic prototype compared a pure JSON Schema document, a single typed manifest with embedded JSON Schema predicates, and a pinned multi-file bundle across seven scenarios. The single manifest was the only candidate to pass every hard requirement.

## Answer

The Method Contract is **one UTF-8 JSON manifest** with a closed `method-contract/1` envelope. The exact stored file is pinned by method version and byte digest. It embeds JSON Schema 2020-12 fragments for artifact shapes and `when` predicates, but uses a small typed envelope for procedure, obligations, completion, verification, rationale pointers, and lifecycle.

This is the normative source. The long guide owns definitions, explanations, examples, evidence synthesis, and provenance. Teaching skills cite contract IDs. The Orchestration Harness evaluates generic schemas, obligations, stops, pins, and owner receipts; it does not interpret or copy method prose.

### V1 envelope

```json
{
  "format": "method-contract/1",
  "id": "methodological-guide-authoring",
  "version": "<normative version>",
  "status": "draft | active | deprecated | retired",
  "guide": { "href": "<guide path>", "role": "rationale-and-provenance" },
  "artifacts": { "A0": {}, "A1": {}, "A2": {}, "A3": {}, "A4": {}, "A5": {}, "A6": {}, "A7": {} },
  "rules": [],
  "completion_profiles": {},
  "verification_hooks": [],
  "lifecycle": {}
}
```

A host-neutral v1 meta-schema validates the closed envelope. That meta-schema defines the contract **format**, not this methodology's normative rules.

### Artifact records

Every `A0`–`A7` record has only four contract-level fields: stable `id`, operational `role`, embedded `schema`, and resolvable `rationale_ref`.

- **A0:** user and situation; action; learning path; verification; rationale and unknowns; next step.
- **A1:** problem; desired outcome; target capability; scope; priority; success metrics; assumptions and constraints.
- **A2:** claim records with K type, E class, provenance, relevance, confidence, rationale-to-recommendation inference, counterconditions, normative assumptions, and review trigger.
- **A3:** roles and authority; prior knowledge; real tasks; work context; resources and constraints; accessibility and equity; user participation.
- **A4:** rule cards in the seven-part executable form below.
- **A5:** meaningful task; complete worked example; decision model and rationale; self-explanation; incomplete example; independent task; transfer/error case.
- **A6:** hypotheses; pilot; expert review; user test; transfer test; implementation observation; data-driven decisions; separate external and self-consistency receipts when applicable.
- **A7:** ownership and rights; version; review triggers; feedback; deviations; distribution; semantic history and retirement.

A0 remains the concise current map after expansion and points to every detailed artifact. Expansion is triggered as follows: purpose sprawl → A1; rationale conflict → A2; audience/context divergence → A3; branching, exceptions, or recovery → A4; inadequate transfer from one example → A5; repeatable verification or metrics → A6; coordinated ownership, versions, or changes → A7.

### Rule record

Each rule has the same closed shape:

```json
{
  "id": "<stable rule id>",
  "trigger": { "target": "<named subject>", "schema": {} },
  "inputs": [],
  "action": [],
  "branches": [{ "when": { "target": "<subject>", "schema": {} }, "then": [] }],
  "output": {},
  "recovery": {},
  "escalation": {},
  "rationale_ref": "<guide anchor>"
}
```

All conditions are JSON Schema fragments applied to a named context, artifact, receipt, or bundle. Typed effects are limited in v1 to `require_artifact`, `require_receipt`, `emit_receipt`, `select_rule`, and `stop`. Concise normative agent instructions may appear in `action`; arbitrary scripts, host-language callbacks, and a general expression language may not.

Adding an effect kind changes the contract format. It is not an ordinary method-content edit.

### Completion profiles

- **Pilot:** schema-valid A0, all triggered obligations satisfied, no unresolved stop.
- **Working:** schema-valid A0 plus every A1–A7 artifact required by observed expansion signals.
- **Evidence-focused:** schema-valid A0 and A1–A7, traceability/audit and external-verification receipts, and matching pins.
- **Metamethodological:** evidence-focused completion plus 49-item audit, leave-one-out, `F(M) ≡ M`, change-propagation, and no-circular-validation receipts.

Self-consistency and external verification are separate receipt classes. Neither satisfies the other.

### Verification hooks

A hook contains `id`, `on`, `check`, `owner`, `required_receipt`, and `rationale_ref`. V1 events are `contract.load`, `artifact.changed`, `context.changed`, `before.complete`, and `before.publish`. V1 checks are limited to contract meta-schema, artifact schema, rule triggers, rationale-link resolution, completion profile, version/digest pins, and owner receipt.

Hooks name checks and receipt owners; they do not embed scripts or move domain semantics into the Orchestration Harness.

### Lifecycle metadata

The contract reserves typed fields for owner, decision rights, version, status, effective date, predecessor, compatibility, review triggers, feedback reference, change log, and retirement. Ticket 12 owns the compatibility, migration, review, and retirement policies; this ticket fixes their representation without pre-deciding those policies.

### Failure and ownership boundaries

Consumers fail closed on an unsupported format or schema dialect, a malformed record, an unresolved artifact/receipt/human/approval/rationale/version obligation, or an ambiguous effect. They never infer completion from prose or self-consistency alone.

Generated tables, per-artifact schemas, adapter types, and examples are non-normative views and carry the manifest version and digest. Split the contract into modules only if measured size or ownership pressure makes the single file unusable; a speculative bundle is rejected.

### Prototype and Ariadne receipts

- [Throwaway Method Contract prototype](../prototypes/04-method-contract-shape.throwaway.html) — seven deterministic scenarios; SHA-256 `b09c52ef17c8449c78362088a71c7330fd7910d3dd104545369c297e741e09fd`.
- [`DEC-method-contract-shape`](../../../.ariadne/GRAPH.jsonl) records the locked representation and boundaries.
- [`VAL-SELECT-method-contract-shape`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter and adversarial critique.
- [`EVD-method-contract-shape-prototype`](../../../.ariadne/GRAPH.jsonl) records the Rung 3 prototype receipt.

Reopen the decision if a required normative decision cannot fit the closed records without arbitrary computation, the single file becomes measurably unusable, or Rung 6 contract tests show divergent interpretation across eligible hosts.
