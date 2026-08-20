# Epistemic Role Contracts

Epistemic roles are responsibility contracts. They are not permanent agents.
One agent MAY perform several roles in sequence. A role MUST label its claims
with provenance and MUST return the artifact named by its contract.

## FramingAgent

The FramingAgent MUST remove premature technology nouns from the request. It
MUST state required behavior, conditions, invariants, and the observable
behavioral delta. It MUST return a `FRAME-*` map and `INV-*` invariants.

## DiagnosticAgent

The DiagnosticAgent MUST start from observed behavior, logs, or traces. It
MUST separate symptoms from mechanisms, construct a causal chain or DAG, and
state a falsification predicate. It MUST return `HYP-*`, `CTR-*`, and relevant
`EVDREQ-*` records.

## ExplorationAgent

The ExplorationAgent MUST expand a narrow solution set by operating on
mechanism classes and orthogonal architectural axes. In Standard or Deep mode
it MUST produce at least three structurally distinct `CAN-*` mechanisms for an
active contradiction and name their Separation Principles.

## ArchitectureAgent

The ArchitectureAgent MUST connect requirements, candidate mechanisms,
dependencies, and boundaries. It MUST state data ownership, coupling, change
radius, and transition implications. It MUST return candidate specifications
and an auditable dependency or decision record.

## DynamicsAgent

The DynamicsAgent MUST model time, load, retries, queues, version skew, and
failure recovery when they affect the claim. It MUST inspect tail latency,
resource accumulation, feedback loops, and metastable failure. It MUST return
`DYN-*` records and falsifiable dynamic conditions.

## ImplementationAgent

The ImplementationAgent MUST implement only a verified or explicitly proposed
Candidate Mechanism. It MUST preserve invariants, record changed artifacts,
and expose executable evidence requests. It MUST NOT author a self-approval or
lock its own `DEC-*` decision.

## VerificationAgent

The VerificationAgent MUST select an Evidentiary Ladder rung that matches the
claim class. It MUST execute the requested check, record the result and
environment, and report supported, falsified, or inconclusive evidence. It
MUST test invariants rather than private implementation details.

## AdversarialReviewerAgent

The AdversarialReviewerAgent MUST independently attack shifted complexity,
hidden mutable state, weak boundaries, unverified assumptions, and degraded
failure behavior. It MUST record explicit attack results and falsification
conditions before a Candidate may become `DECIDED`.

## Host mapping

In GSD mode, host agents load the relevant rule file as a role lens. In a
multi-agent Deep run, roles MAY execute in isolated worktrees and exchange
schema-validated Epistemic Envelopes. In a single-agent run, the roles MUST be
performed sequentially with quality gates between transitions.
