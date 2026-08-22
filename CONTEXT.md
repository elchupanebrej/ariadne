# Ariadne Software Reasoning Layer

Ariadne is a software reasoning skill, CLI, and epistemic layer that models engineering uncertainty, causal hypotheses, contradictions, and systematic inventive transformations for autonomous agents and software engineers.

## Language

### Epistemic Foundations & Provenance

**Epistemic State**:
The explicit status of whether an engineering claim, invariant, or mechanism is backed by empirical proof, deductive derivation, or unverified assumptions.
_Avoid_: Confidence score, belief state, agent feeling, certainty level

**Provenance Lattice**:
The formal partial order ($\mathbf{U} \sqsubset \mathbf{A} \sqsubset \mathbf{P} \sqsubset \mathbf{D} \sqsubset \mathbf{M} \sqsubset \mathbf{F} \sqsubset \mathbf{L}$) establishing the evidentiary rigor and derivation validity of every claim in the problem model.
_Avoid_: Trust score, verification rank, priority scale

**Weakest-Precondition Rule**:
The logical rule dictating that a deduction is only as valid as the least certain premise in its antecedent chain.
_Avoid_: Error propagation, pessimistic rating, cascade degradation

**Transitive Invalidation**:
The automatic propagation of invalidation down the epistemic dependency graph when a foundational assumption or causal hypothesis is falsified by empirical evidence.
_Avoid_: Cascade failure, ripple delete, cache purge

**Epistemic Overlay**:
A typed metadata graph attached to tasks and plans that tracks claims, hypotheses, evidence, and invalidation rules without taking over task management.
_Avoid_: State machine, ticket wrapper, meta-plan

**Methodological Guide**:
A normative guide that connects rationale, executable rules, a learning path, verification, and lifecycle governance for one method.
_Avoid_: Skill, harness, documentation bundle

**Method Contract**:
The compact, versioned, executable source of normative method rules referenced by the methodological guide, teaching skills, and orchestration harness.
_Avoid_: Book, runtime code, copied skill instructions

**Teaching Skill**:
An agent instruction entry point that reloads a method's triggers, rules, worked example, and artifact contract for a fresh session.
_Avoid_: Methodological guide, orchestration harness, runtime

**Orchestration Harness**:
A host-neutral operational boundary that lets a fresh session continue from repository-visible owner receipts while leaving workflow semantics, epistemic state, human decisions, and host permissions with their existing owners. A dedicated runtime is only one candidate implementation.
_Avoid_: Ariadne, teaching skill, methodology, wrapper, necessarily a separate process

**Orchestration Kernel**:
The optional, deletable executable component that atomically persists pointer-only Orchestration Attempts when a thinner host path cannot satisfy the Orchestration Harness contract.
_Avoid_: Standalone runtime service, AriadneHarnessController, mandatory product

**Clean-Session Run**:
An evaluation attempt started without prior author or session context, using only declared pinned inputs and whitelisted capabilities recorded in an auditable input manifest.
_Avoid_: Fresh-agent test, blank session, clean slate

**Tested Release Bundle**:
An immutable, non-normative compatibility snapshot that pins one owner-published version and digest for every required component together with the evidence that the combination passed.
_Avoid_: Release train, source of truth, compatibility range, latest version

**Change Impact Receipt**:
An owner-issued statement of which published surface changed, which consumers are affected, and which new-version or compatibility evidence each affected owner must return before bundle publication.
_Avoid_: Changelog, global rebuild request, inferred dependency update

**Orchestration Attempt**:
The harness-owned lifecycle record for one pinned continuation, containing only generic status, version pins, cursors, counters, and owner pointers.
_Avoid_: Workflow, agent session, task, transaction

**Dispatch Intent**:
The durable orchestration event recorded before one owner operation is invoked, binding the attempt revision, opaque step, inputs, authorization, idempotency key, and replay budget.
_Avoid_: Tool call, permission grant, completed effect

**Owner Effect Receipt**:
An owner-issued pointer that authoritatively classifies an invoked operation as committed, no-effect, or ambiguous without copying owner state into the harness.
_Avoid_: Harness inference, rollback record, success log

**Replay Declaration**:
An owner-issued, operation-specific statement permitting another dispatch under a stable idempotency key, finite budget, and deadline.
_Avoid_: Automatic retry policy, generic idempotency flag

**Pending Action**:
A pointer-only statement of the authority, evidence, action, and resume predicate required before a waiting orchestration attempt may advance.
_Avoid_: Human answer, escalation workflow, harness-owned approval

**Staged Self-Application**:
A versioned bootstrap in which methodology authoring creates harness authoring, harness authoring specifies the runtime, and the runtime reapplies the method to itself before a fixed-point check.
_Avoid_: Mutual runtime recursion, circular validation, self-proof

**Decision-Significant Unknown**:
An unverified fact or missing measurement whose empirical outcome can alter the choice of candidate mechanism or invalidate an entire architectural path.
_Avoid_: Open question, research topic, todo item

**Falsification**:
The empirical demonstration that a causal hypothesis, assumption, or candidate mechanism fails an observed invariant or executable test.
_Avoid_: Disproof, bug finding, failure, rejection

### Problem Modeling & Contradictions

**Problem State Tuple ($\mathcal{S}_t$)**:
The formal representation of an engineering problem at time $t$, composed of Behavioral Requirements, Invariants, Contradictions, Candidate Mechanisms, and the Epistemic Graph ($\langle \mathcal{B}_t, \mathcal{I}_t, \mathcal{C}_t, \mathcal{M}_t, \mathcal{E}_t \rangle$).
_Avoid_: Task state, ticket context, problem description

**Technical Contradiction**:
A trade-off where improving one system parameter or quality metric intrinsically degrades another under the existing architecture.
_Avoid_: Trade-off, dilemma, engineering friction, compromise

**Physical Contradiction**:
A state where a single software component, parameter, or boundary must simultaneously exhibit mutually exclusive properties to satisfy conflicting demands.
_Avoid_: Paradox, impossible requirement, race condition

**Separation Principles**:
The four software-adapted inventive principles (separation in time, in data/state ownership, in operating conditions/modes, and across system boundaries) used to eliminate contradictions without compromise.
_Avoid_: Compromise tuning, trade-off balancing, weighted scoring

**Multi-Screen Scheme (System Operator)**:
A 9-box thinking model that contextualizes a software component across three structural levels (Subsystem, System, Supersystem) and three temporal horizons (Past, Present, Future).
_Avoid_: Architecture diagram, 3x3 matrix, timeline

**Causal Hypothesis**:
A testable, falsifiable proposition explaining the underlying computational mechanism behind a defect, regression, or observed behavior.
_Avoid_: Guess, suspicion, idea, theory

### Inventive Operations & Architecture

**Reasoning Operation**:
One of the nine formal transformations of an engineering problem model derived from systematic inventive thinking for software (frame, diagnose, transform, explore, knowledge, dependencies, dynamics, value, validate).
_Avoid_: Prompt trick, heuristic, reasoning step, workflow phase

**Candidate Mechanism**:
A structurally distinct solution variant that implements a required function using a specific computational mechanism, state ownership model, or system boundary.
_Avoid_: Solution idea, implementation detail, proposal, PR

**Ideality**:
The objective ratio of useful software functions delivered to the sum of harms, resource overheads, and complexity costs ($I = \frac{\sum UF}{\sum H + \sum C}$).
_Avoid_: Efficiency, quality score, goodness, ROI

**Trimming (Component Elimination)**:
The systematic removal of a software component, dependency, or intermediate state by redistributing its essential functions to other existing elements or the runtime environment.
_Avoid_: Dead code removal, refactoring, stripping, deleting

**Anti-System**:
A complementary or adversarial system model configured with the inverse objectives, failure modes, or constraints of the primary system to uncover latent vulnerabilities.
_Avoid_: Chaos tool, stress test, dark mode, shadow system

**Change Radius**:
The maximal set of transitive modules, database schemas, and external contracts affected when modifying a given component.
_Avoid_: Blast radius, impact area, diff size, footprint

### System Dynamics & Empirical Evidence

**Metastable Failure**:
A persistent, self-sustaining degraded state in a distributed system where internal feedback loops (such as retry storms or queue buildup) prevent recovery even after the trigger fault ceases.
_Avoid_: Crash, overload, brownout, outage

**Evidentiary Ladder**:
An ordinal hierarchy of 10 verification rungs (from static plausibility to production observability) ranked strictly by empirical rigor and falsification power.
_Avoid_: Test pyramid, CI pipeline, testing strategy

**Mutation Score Indicator (MSI)**:
The percentage of synthetically injected code mutations killed by an automated test suite, measuring test falsification efficacy.
_Avoid_: Code coverage, test quality, assertion count

**Evidence Request (`EVDREQ-`)**:
A concrete specification of an automated test, benchmark, trace capture, or repository inspection designed to prove or falsify a specific claim.
_Avoid_: Task, ticket, test ticket, spike request

**Evidence Result (`EVD-`)**:
The empirical outcome, quantitative measurement, or execution log produced by fulfilling an Evidence Request.
_Avoid_: Test log, benchmark note, result report

### Transition Architecture & Governance

**Transition Architecture (`TRANS-`)**:
The temporary structural mechanisms (dual-writing, feature flags, data migrations, backward compatibility layers) designed to safely bridge current and target systems without service disruption.
_Avoid_: Deployment script, rollout step, release plan

**Expand-Contract Migration**:
A two-phase stateful transition pattern that first expands the schema or contract to support legacy and new formats concurrently, migrates state, and then contracts the system to retire legacy paths.
_Avoid_: Zero-downtime deploy, database patch, migration job

**Adversarial Critique**:
A structured adversarial review of a candidate mechanism that aggressively probes for complexity shifts, hidden mutable states, degraded resilience, or unverified assumptions.
_Avoid_: Code review, peer feedback, second opinion

**Epistemic Degradation Mode**:
Ariadne's capability to adjust its execution rigor across 4 operational modes (A: Full Suite, B: GSD+Ariadne, C: Matt+Ariadne, D: Standalone) based on available host tools without crashing.
_Avoid_: Fallback error, degraded mode, graceful crash

**Epistemic Depth Mode**:
An orthogonal execution parameter (`Fast`, `Standard`, `Deep`) that sets artifact completeness, required candidate mechanism count, and mandatory adversarial critique independent of the host deployment mode.
_Avoid_: Rigor level, detail setting, prompt length, verbosity

**Claim-Class Compatibility Gate**:
A deterministic code gate that enforces a strict mathematical mapping between claim categories and the minimum Evidentiary Ladder rung required to verify or falsify them.
_Avoid_: Test filter, validation check, assertion rule

**Decommissioning Contract**:
The mandatory specification on a transition node (`TRANS-*`) defining its target mechanism, retirement predicate, expiration deadline, and executable cleanup verification test.
_Avoid_: Cleanup ticket, tech debt note, temporary flag

**Ephemeral Role Subagent**:
A short-lived worker agent instantiated on demand with a specialized epistemic role contract (such as Adversarial Reviewer or Spike Investigator) that returns structured graph mutations without polluting permanent tool context.
_Avoid_: Background daemon, permanent subagent, helper bot

**Epistemic Delta Envelope**:
A structured, schema-validated JSON payload (`ariadne-delta`) emitted by subagents to propose atomic graph node creations, edge bindings, or invalidation mutations.
_Avoid_: Agent report, unstructured diff, subagent response

**Operational Notice**:
A structured, non-invasive signal (`NOT-*`) registered in `.planning/ariadne/NOTICES.jsonl` and `STATE.yaml` that alerts external orchestrators (like GSD) to assumption falsifications without mutating historical phase records.
_Avoid_: Error log, plan override, interrupt message

**Transition Lifecycle**:
The 6-state formal progression (`PROPOSED` -> `EXPANDED` -> `DUAL_RUNNING` -> `MIGRATING` -> `CONTRACTED` -> `RETIRED`) strictly governing the creation, verification, and retirement of temporary architectural mechanisms.
_Avoid_: Migration status, release phase, ticket progress

**Separation Diversity Rule**:
The epistemic quality gate requiring that any active technical contradiction be addressed by at least three candidate mechanisms spanning distinct separation principles before locking decisions.
_Avoid_: Multi-solution rule, brainstorming quota, candidate threshold
