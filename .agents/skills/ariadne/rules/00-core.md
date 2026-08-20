# Core Epistemic Governance

## Scope

Ariadne is an Epistemic Overlay. It records engineering claims, assumptions,
hypotheses, contradictions, unknowns, candidate mechanisms, evidence, and
decisions. It does not manage delivery work or replace an external project
orchestrator.

Every operation MUST preserve the Problem State Tuple:
`<Behavioral Requirements, Invariants, Contradictions, Candidate Mechanisms,
Epistemic Graph>`. Each significant statement MUST carry an Epistemic State
and a provenance value.

## Canonical vocabulary

Use these terms exactly:

- `CLM-*`: Claim; `ASM-*`: Assumption; `HYP-*`: Causal Hypothesis.
- `CTR-*`: Technical or Physical Contradiction; `UNK-*`: Decision-Significant Unknown.
- `CAN-*`: Candidate Mechanism; `EVDREQ-*`: Evidence Request; `EVD-*`: Evidence Result.
- `TRANS-*`: Transition Architecture; `DEC-*`: locked Decision.
- `NOT-*`: Operational Notice; `EXP-*`: Experiment.

An ID MUST use its canonical prefix and a non-empty suffix. A node MUST have a
stable ID, a title, a statement or payload, an Epistemic State, provenance,
and revision metadata. A mutation MUST validate the complete node and every
referenced edge before it is persisted.

## Provenance Lattice

The Provenance Lattice is the strict order:

`UNKNOWN ⊏ ASSUMED ⊏ PROPOSED ⊏ DERIVED ⊏ MEASURED ⊏ FACT ⊏ DECIDED`.

- `UNKNOWN` means required information is missing.
- `ASSUMED` means an unverified working premise is in use.
- `PROPOSED` means a Candidate Mechanism is under evaluation.
- `DERIVED` means a deduction follows from verified antecedents.
- `MEASURED` means a reproducible quantitative observation exists.
- `FACT` means repository, code, or active configuration evidence is directly observed.
- `DECIDED` means a human or quality gate locked the architectural choice.

Provenance is evidence, not confidence and not a priority score. An agent MUST
not promote an `ASSUMED` or `UNKNOWN` statement to `FACT` or `DECIDED`.

## Weakest-Precondition Rule

For a deductive claim `C` with premises `P1..Pn`, Ariadne MUST calculate:
`prov(C) = meet(prov(P1)..prov(Pn))`.

The meet MUST clamp a result to `UNKNOWN` when any premise is `UNKNOWN`, and to
`ASSUMED` when no premise is `UNKNOWN` and at least one premise is `ASSUMED`.
`DERIVED` is valid only when all premises are `FACT`, `MEASURED`, or `DERIVED`.
An `ASSUMED` premise MUST NOT justify a locked `DEC-*` node in Standard or Deep
mode.

## Graph and ownership invariants

The graph MUST preserve referential integrity. A `derived_from` or `depends_on`
edge MUST form a Directed Acyclic Graph. A cycle MUST be represented as a
`CTR-*` node, not as a deductive cycle. Historical graph events MUST remain
append-only; invalidation records a new event and does not delete a node.

When GSD owns the project, `.planning/PROJECT.md`, `REQUIREMENTS.md`,
`ROADMAP.md`, and `STATE.md` are canonical. Ariadne MUST write only the
epistemic overlay under `.planning/ariadne/`. In Standalone mode it MAY write
the self-contained `.ariadne/` state.

Quality gates MUST run before a decision is locked. A locked decision MUST
reference its evidence, candidate, and unresolved-risk state. Operation rules
define operation-specific artifacts; this file defines shared invariants only.
