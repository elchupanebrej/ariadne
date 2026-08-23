# Methodological Harness System

Triage: `ready-for-agent`

## Problem Statement

A fresh agent session cannot currently learn and apply Ariadne, author a
Methodological Guide, design the smallest justified agent harness, or continue
a paused cross-skill attempt using only declared repository-visible context.
Success still risks depending on hidden author knowledge, copied normative
rules, or human memory of an earlier session.

The long Methodological Guide contains the rationale and complete method, but
it is not a compact executable contract. Ariadne owns Epistemic State, Matt
Pocock Skills and the local issue tracker own workflow state, each host owns its
model loop and permissions, and humans own judgments and approvals. Teaching
and orchestration must work across those boundaries without creating shadow
copies or a centralized replacement workflow.

The system must also demonstrate its own construction. It needs a staged,
acyclic self-application process that can establish structural closure without
misrepresenting self-consistency as evidence of teaching effectiveness or
runtime safety. Any Teaching Skill or Orchestration Kernel that adds no
observable value over a thinner matched baseline must be removed.

## Solution

Provide a source-pinned Methodological Harness System composed of:

- One compact, versioned Method Contract containing the executable normative
  rules for the guide's A0 and A1-A7 artifacts, completion profiles,
  verification hooks, rationale links, and lifecycle metadata.
- An Ariadne Teaching Skill that teaches progressive Reasoning Operation
  routing through one complete, evidence-backed worked example.
- A Methodology Authoring Teaching Skill that teaches a fresh session to create
  a complete Methodological Guide from the pinned Method Contract.
- A Harness Authoring Teaching Skill grounded in pinned primary-source harness
  research and driven by observed lifecycle failures rather than assumed
  architecture.
- Owner-approved Matt and Ariadne adapters with a shared pointer-only lifecycle
  contract that preserves direct use and existing state ownership.
- A host-neutral Orchestration Harness that provides repository-visible
  Orchestration Attempt continuity, generic gates, pins, recovery pointers, and
  lifecycle events only where the thin existing path cannot satisfy a hard
  requirement.
- A staged self-application process that builds the Method Contract, Teaching
  Skills, and optional Orchestration Kernel in immutable rounds, then checks two
  isolated complete applications for the same normalized normative result.
- Matched Clean-Session Runs that separately evaluate teaching, transfer,
  orchestration, hidden-context exclusion, structural self-consistency, and the
  continued necessity of every added layer.

The result complements Matt Pocock Skills and Ariadne. It does not replace
their owners, make the Orchestration Kernel mandatory, or turn a local harness
into a standalone agent runtime.

## User Stories

1. As a fresh agent, I want to begin with a meaningful task, so that I learn the method through use rather than by loading a reference manual.
2. As a fresh agent, I want only the source triggered by the current decision branch to load, so that context remains bounded.
3. As a learner, I want one complete worked example with all required artifacts and receipts, so that I can inspect the method end to end.
4. As a learner, I want to explain the worked example after its runnable check passes, so that narrative confidence cannot replace an observable result.
5. As a learner, I want to complete a faded case, so that I demonstrate the method without copying every step.
6. As a learner, I want to route a structurally changed transfer case, so that completion proves more than memorization of one path.
7. As a learner, I want to practice targeted recovery, so that I can repair the failed artifact or owner boundary without restarting unrelated work.
8. As a maintainer, I want Teaching Skills to cite live Ariadne rules, Method Contract identifiers, and guide rationale, so that normative truth retains one owner.
9. As a maintainer, I want Teaching Skills to reject copied normative sources, so that their Change Radius stays bounded.
10. As a verifier, I want every Teaching Skill to provide one runnable completion check, so that its artifacts and invalid paths are mechanically testable.
11. As a fresh Ariadne learner, I want a small parser decision as the first task, so that framing, candidate selection, and evidence matching are concrete.
12. As a fresh Ariadne learner, I want a proposed package treated as a Candidate Mechanism rather than a requirement, so that behavior is separated from implementation.
13. As a fresh Ariadne learner, I want three structurally distinct parser candidates filtered by hard requirements, so that the first plausible mechanism is not assumed to be correct.
14. As a fresh Ariadne learner, I want executable parser checks to produce the required Evidence Result, so that the final decision is supported at the correct Evidentiary Ladder rung.
15. As a fresh Ariadne learner, I want a native query-string faded case, so that I can repeat the selection shape with less guidance.
16. As a fresh Ariadne learner, I want a duplicate-effect retry transfer case, so that I demonstrate a changed Diagnose and Dynamics route.
17. As an Ariadne maintainer, I want the teaching graph isolated from the live Epistemic Overlay, so that lessons cannot corrupt repository reasoning state.
18. As a Methodological Guide author, I want to start with a concise A0, so that the current method map remains readable.
19. As a Methodological Guide author, I want A1-A7 to expand only when their observed signals fire, so that the guide is complete without speculative bulk.
20. As a Methodological Guide author, I want every material recommendation to include a case-specific rationale-to-recommendation inference, so that a citation is not mistaken for reasoning.
21. As a Methodological Guide author, I want roles and authority recorded explicitly, so that the guide cannot synthesize an owner's judgment.
22. As a Methodological Guide author, I want branching, recovery, and escalation represented as executable rule records, so that completion does not depend on prose interpretation.
23. As a Methodological Guide author, I want external verification separated from self-consistency, so that one receipt cannot satisfy a different claim.
24. As a Methodological Guide author, I want version, ownership, feedback, deviation, and retirement decisions recorded, so that the guide can evolve without losing provenance.
25. As a Methodological Guide learner, I want a complete dependency-change review guide example, so that A0 and A1-A7 are demonstrated as one vertical slice.
26. As a Methodological Guide learner, I want an incident-handoff faded case and a metamethodological transfer case, so that ordinary authoring and self-application are both tested.
27. As a harness author, I want to define repository-observable success, failure, and stop outcomes before selecting a mechanism, so that architecture follows demonstrated need.
28. As a harness author, I want to test the thin existing path before adding a new boundary, so that an unnecessary Orchestration Kernel is a valid deletion result.
29. As a harness author, I want every datum and enforcement responsibility assigned to one owner, so that the harness does not shadow method, workflow, epistemic, host, or human state.
30. As a harness author, I want every retained mechanism linked to an observed trigger, so that speculative services and dependencies are rejected.
31. As a harness author, I want the thin path, a host-specific adapter, and a neutral kernel filtered non-compensatorily, so that a failed hard requirement cannot be averaged away.
32. As a harness author, I want owner payloads retained behind resolvable pointers, so that the harness stores continuity without taking semantic ownership.
33. As a Harness Authoring learner, I want a complete dependency-review continuation example, so that approval waiting and ambiguous-effect recovery are inspectable.
34. As a Harness Authoring learner, I want an issue-triage faded case and a staged-self-application transfer case, so that minimality and acyclic construction are demonstrated.
35. As a method owner, I want one closed versioned Method Contract, so that normative artifacts and rules can be validated without parsing the long guide.
36. As a method owner, I want the long guide to retain definitions, rationale, examples, evidence synthesis, and provenance, so that the compact contract does not duplicate it.
37. As a fresh session, I want to identify exactly one valid next action from pinned repository-visible state, so that continuation needs no hidden human memory.
38. As a user, I want human, approval, invalid-artifact, pin-mismatch, unsupported-capability, expired, and ambiguous-effect boundaries to stop safely, so that the harness cannot invent authority or certainty.
39. As a user, I want Matt skills and Ariadne to remain directly usable outside orchestration, so that the harness is a complement rather than a gateway.
40. As an owner, I want requests, receipts, artifacts, state, approvals, and traces retained behind owner pointers, so that copied payloads do not become shadow state.
41. As an operator, I want every Orchestration Attempt to have a unique observable disposition, so that continuation and escalation are deterministic.
42. As an operator, I want replay to default to zero, so that process loss cannot automatically duplicate an owner effect.
43. As an operator, I want retry to require an owner Replay Declaration, stable idempotency key, finite budget, deadline, and resolved effect, so that replay authority is explicit and bounded.
44. As an operator, I want cancellation to remain intent until an owner terminal receipt arrives, so that cancellation is never confused with rollback.
45. As an operator, I want an ambiguous effect resolved only by an Owner Effect Receipt, so that the harness does not infer commitment or compensation.
46. As a Method Contract owner, I want immutable bootstrap rounds with exact versions and digests, so that self-application never rewrites active inputs.
47. As a verifier, I want two isolated complete self-applications to produce the same normalized normative projection as the input, so that structural promotion has an executable fixed-point check.
48. As a verifier, I want self-consistency, teaching effectiveness, adapter conformance, runtime necessity, and recovery safety reported as separate claims, so that success in one area cannot compensate for failure in another.
49. As a component owner, I want independent owner-controlled versions assembled into an immutable Tested Release Bundle, so that compatibility does not require a centralized release train.
50. As a component owner, I want a Change Impact Receipt to identify affected consumers, so that only components touched by a change must publish new compatibility evidence.
51. As an attempt owner, I want active attempt pins preserved during migration, so that an in-flight effect is never reinterpreted under a different bundle.
52. As a maintainer, I want retirement to require an active successor, drained attempts, owner approval, and cleanup evidence, so that compatibility debt does not remain indefinitely.
53. As an evaluator, I want every advertised host, model, and adapter combination tested in isolated Clean-Session Runs, so that support claims remain bounded to observed environments.
54. As an evaluator, I want hidden inputs and author intervention audited, so that a passing run cannot depend on undeclared context.
55. As a maintainer, I want a Teaching Skill or Orchestration Kernel deleted when its matched thinner baseline passes the same critical criteria, so that the system retains only evidence-backed layers.

## Implementation Decisions

- The Method Contract is one UTF-8 JSON manifest with a closed
  `method-contract/1` envelope, pinned by its owner-native version and byte
  digest.
- The Method Contract is the compact normative source for A0 and A1-A7 artifact
  schemas, rule records, completion profiles, verification hooks, rationale
  references, and lifecycle metadata. The long Methodological Guide retains
  definitions, explanations, examples, evidence synthesis, and provenance.
- Every A0-A7 contract record has a stable identifier, operational role,
  embedded JSON Schema predicate, and resolvable rationale reference. A0 remains
  the concise map and records why each detailed artifact expands.
- Rule records have a trigger, inputs, ordered actions, branches, output,
  recovery, escalation, and rationale reference. Version one supports only
  artifact requirements, receipt requirements, receipt emission, rule
  selection, and stopping as effect kinds.
- Arbitrary scripts, host-language callbacks, general expression languages,
  and prose-derived completion are excluded from the Method Contract.
- Pilot, working, evidence-focused, and metamethodological completion profiles
  are distinct. External-verification and self-consistency receipts cannot
  satisfy one another.
- Each Teaching Skill owns lesson order, fixtures, prompts, fading, transfer,
  targeted recovery, and completion guidance only. It links to pinned sources
  and does not copy the Method Contract, Ariadne rules, guide rationale, or
  owner state.
- The Ariadne Teaching Skill progressively loads the router, uncertainty rule,
  selected Reasoning Operation rules, graph mutation contract, and relevant
  cross-cutting evidence rule. It does not preload unrelated rules.
- The Ariadne worked example frames a config-line parser, compares three
  Candidate Mechanisms, selects the standard-library mechanism only after hard
  requirement filtering, and locks the decision only after matched algorithmic
  evidence passes.
- The Methodology Authoring Teaching Skill starts from pinned guide and Method
  Contract inputs, drafts A0, expands A1-A7 on observed signals, preserves live
  rationale links, runs contract gates, and teaches recovery from pin,
  artifact, rationale, authority, and circularity failures.
- The Methodology Authoring worked example is an evidence-focused guide for a
  first-time maintainer reviewing a dependency change. It demonstrates
  repository verification, security and license authority boundaries,
  disposition rules, external verification, and lifecycle ownership.
- The Harness Authoring Teaching Skill starts from an observable lifecycle
  failure, writes outcomes before architecture, assigns every datum to one
  owner, tests the thin baseline, and retains only mechanisms justified by a
  failed hard invariant.
- The Harness Authoring worked example is a dependency-review continuation
  across fresh sessions with an approval wait and a process loss after an owner
  effect. It demonstrates inspection-based recovery without duplicate replay.
- A passing thin baseline is a complete Harness Authoring result and removes
  the proposed Orchestration Kernel.
- Matt and Ariadne adapters share the lifecycle surface established by the
  adapter prototype:

  ```text
  capabilities()
  start(request reference)
  resume(external run reference, input reference)
  cancel(external run reference, reason reference)
  events(external run reference, cursor)
  ```

- Matt requests name a pinned skill and required artifact kinds. Matt and the
  issue tracker retain workflow meaning. Ariadne requests name a pinned
  preflight, graph, ingest, gate, invalidation, or handoff operation. Ariadne
  alone validates and mutates its Epistemic Overlay.
- The host retains the model and tool loop, process execution, physical
  cancellation, sandbox, permissions, native session, and traces. Adapters own
  only translation, capability declaration, validation, lifecycle
  normalization, and conformance receipts.
- Direct Matt and Ariadne results may join an Orchestration Attempt through
  pinned owner receipt and artifact pointers. Direct use remains valid and is
  not intercepted.
- The Orchestration Harness owns only the attempt identifier, opaque step,
  lifecycle status, revision, attempt counter, exact pins, idempotency key and
  deadline, replay budget, event cursor, cancellation intent, and owner
  pointers.
- The lifecycle state machine, retained from the prototype, is:

  ```text
  created -> running -> waiting -> running -> succeeded | failed | canceled
  ```

  Timeout, stall, and error are reasons rather than extra top-level states.
- The host process and workspace form the trusted local version-one boundary.
  Adapter events, artifacts, receipts, versions, digests, bindings, and owners
  remain untrusted until validated.
- Approval pointers are bound to the attempt, operation, inputs, and expiry.
  The host revalidates and enforces native permission at dispatch. The harness
  never grants or broadens authority.
- A Dispatch Intent is durably accepted against the current attempt revision
  before an owner operation is invoked. A stale revision cannot dispatch, and
  an existing intent requires inspection rather than another dispatch.
- Replay defaults to zero. It requires an owner-issued operation-specific
  Replay Declaration, stable idempotency key, finite pinned budget, deadline,
  no ambiguous effect, and at most one in-flight dispatch for the opaque step.
- Equal event cursors and digests are idempotent no-ops. Conflicting duplicates,
  cursor gaps or regressions, invalid lifecycle transitions, corrupt state, and
  mismatched pins fail closed.
- Cancellation remains intent until the owner returns a terminal receipt. A
  committed late success remains succeeded, canceled requires owner
  acknowledgment, and an ambiguous effect remains waiting.
- Only an Owner Effect Receipt declaring committed or no-effect resolves an
  ambiguity. Compensation is a separate owner-authorized operation linked to
  immutable prior history.
- Observability is pointer-only. Normalized events cover lifecycle transitions,
  dispatch, gates, retry, cancellation, recovery, and escalation while the host
  owns payload capture, redaction, retention, export, alerting, metrics, and
  native traces.
- Every waiting or failed disposition names a stable reason, authority pointer,
  evidence pointers, Pending Action, resume predicate, and optional deadline.
- A separate Orchestration Kernel is conditional. The thin
  skill-loader-plus-owner-artifacts path is implemented and evaluated first.
  The kernel is retained only if it passes a hard continuation invariant that
  every thinner eligible candidate fails.
- If retained, the Orchestration Kernel is one co-located owner-neutral internal
  TypeScript module using the repository's existing runtime, validation, and
  filesystem capabilities. It is not added to Ariadne's controller or
  Epistemic Overlay.
- The retained kernel uses one pointer-only append ledger per Orchestration
  Attempt and serializes only that attempt. It validates the expected revision,
  makes Dispatch Intent durable before invocation, and recovers at most an
  incomplete final record.
- The kernel claims process-crash atomicity only for the tested local
  same-volume filesystem. Power-loss durability, remote coordination, and
  distributed concurrency remain unclaimed.
- No package, daemon, service, database, queue, scheduler, IPC protocol, global
  lock, migration framework, rollback engine, compensation engine, or alert
  router is added without an observed requirement.
- Staged Self-Application uses immutable owner-gated bootstrap rounds. The build
  order is guide, Method Contract, Methodology Authoring Teaching Skill, Harness
  Authoring Teaching Skill, optional Orchestration Kernel, and then two isolated
  Method Contract assessments.
- Harness Authoring is a build-time input to the Orchestration Kernel, not a
  runtime callback. Active builders and the active harness never invoke or
  rewrite one another.
- Each assessment emits the complete method artifacts, full audit and
  leave-one-out results, change-propagation matrix, complete Method Contract
  candidate, normalized normative projection, and pin, completion,
  no-circular-validation, and independence receipts.
- The fixed-point decision retained from the prototype is
  `N(F_A(M_n)) = N(M_n) = N(F_B(M_n))`, where normalization removes only
  release-instance metadata and preserves executable ordering and normative
  links.
- Any normative delta, assessor disagreement, pin drift, missing independence,
  unresolved stop, or runtime cycle halts the round. An owner-accepted delta
  starts a new immutable round; the harness never loops itself to convergence.
- Component owners retain independent version and lifecycle authority. Exact
  owner versions and digests are assembled into immutable, non-normative Tested
  Release Bundles.
- A changed owner emits a Change Impact Receipt. Every affected consumer owner
  publishes a new version or digest-bound compatibility receipt before bundle
  publication. Compatibility ranges select tests but do not authorize
  execution.
- New Orchestration Attempts use the active successor bundle while existing
  attempts drain under their pinned deprecated bundle. Attempts are never
  upgraded in place.
- Retirement requires an active successor, passed migration and compatibility
  checks, no supported consumer or nonterminal attempt on the tuple, an expired
  deprecation period, owner approvals, and a passing cleanup verification.
  Historical manifests and receipts remain available for audit.

## Testing Decisions

- Tests assert observable outcomes, owner boundaries, persisted receipts, and
  terminal dispositions rather than internal helper calls or prompt wording.
- The highest seam is a matched Clean-Session Run across a new host session or
  process. It must prove that declared pinned inputs are sufficient to teach,
  transfer, continue, wait, recover, or stop without author memory.
- The completed Wayfinder decisions define this seam: held-out faded and
  changed-transfer tasks run twice for every advertised host, model, and
  adapter combination, with an audited input manifest and isolated workspace.
- The Ariadne Teaching Skill is tested through its complete parser path, its
  isolated graph gates, a faded query-string case, and a changed duplicate
  effect route. Tests verify the selected Reasoning Operations, required cards,
  matched Evidentiary Ladder rung, and source ownership.
- The Methodology Authoring Teaching Skill is tested through a complete
  dependency-review guide, a faded incident-handoff guide, and a
  metamethodological transfer. Tests verify every triggered A0-A7 artifact,
  rationale inference, owner receipt, recovery decision, completion profile,
  and acyclic transfer.
- The Harness Authoring Teaching Skill is tested through a complete
  dependency-review continuation, a faded issue-triage continuation, and a
  staged-self-application transfer. Tests verify baseline-first selection,
  single ownership, triggered mechanisms, pointer-only records, fail-closed
  recovery, and a valid no-kernel result.
- The Method Contract is tested at its public validation boundary for closed
  schemas, rule triggers, effect kinds, rationale resolution, obligations,
  completion profiles, verification hooks, exact pins, lifecycle declarations,
  and rejection of unsupported or ambiguous content.
- Owner adapters are tested at their shared lifecycle contract for capability
  negotiation, invocation, waiting and resumption, direct-result import,
  cancellation acknowledgment, cursor handling, invalid receipts, unsupported
  versions, replay rejection, and absence of copied owner state.
- The Orchestration Harness is tested end to end for cold start, mid-run reset,
  approval reset, crash around an owner effect, corrupt artifact, pin drift,
  fake and production adapter conformance, and exactly one valid next
  disposition after every restart.
- Each safety boundary receives an independent fault injection: malformed or
  owner-mismatched receipts, pin drift, process reset, approval failure, stale
  concurrent dispatch, duplicate or gapped events, cancellation races,
  ambiguous effects, false effect receipts, and unauthorized replay.
- Effects are simulated in disposable workspaces. Tests never create or replay
  a real ambiguous external effect.
- Deterministic contract and artifact checks run before blinded semantic review.
  An independent operator audits isolation and access; an independent domain
  reviewer scores correctness, transfer, recovery, and owner boundaries.
- Every critical criterion is non-compensatory. Results are reported as
  supported, falsified, or inconclusive by claim, task, environment, adapter,
  fault, and baseline arm.
- Evidentiary Ladder Rung 2 covers schema, compilation, type, and lint behavior.
  Rung 3 covers deterministic artifact, route, example, and lifecycle-model
  behavior.
- Validator-suite quality requires Rung 5 mutation evidence with a Mutation
  Score Indicator of at least 85 percent and every critical isolation,
  ownership, evidence, lifecycle, circularity, and deletion mutant killed.
- Teaching and transfer, real-owner adapter conformance, and comparative kernel
  necessity require Rung 6 Clean-Session evidence bounded to the tested
  combination.
- Crash, concurrency, replay, cancellation, ambiguous-effect, and recovery
  safety require Rung 8 fault evidence before a production-safety claim.
- Each Teaching Skill is compared with the same pinned task and normative
  sources but without that Teaching Skill. The Orchestration Kernel is compared
  with the thin skill-loader-plus-owner-artifacts path under identical
  conditions.
- A Teaching Skill or Orchestration Kernel is deleted or inlined when its
  matched thinner baseline passes the same critical criteria. Variable results
  remain inconclusive and do not justify speculative retention.
- Existing fresh-process standalone recovery tests are prior art for the
  Clean-Session process seam and repository-visible recovery assertions.
- Existing normative acceptance scenarios are prior art for end-to-end owner
  boundaries, direct capability use, handoff behavior, and non-shadow state.
- Existing adapter tests are prior art for receipt validation, handoff
  generation, owner-controlled ingestion, and fail-closed invalid inputs.
- Existing graph storage and operational notice tests are prior art for atomic
  append, expected-state transactions, concurrent writers, idempotency, and
  incomplete-final-record recovery.
- Existing gate tests are prior art for deterministic structural, semantic,
  and epistemic receipts and for rejecting invalid artifacts before mutation.
- Structural fixed-point success, teaching effectiveness, adapter conformance,
  comparative kernel necessity, and recovery safety remain separate test
  claims. No receipt from one seam satisfies another.

## Out of Scope

- Replacing Matt Pocock Skills, the local issue tracker, Ariadne's Epistemic
  Overlay, Method Contract ownership, host sessions and permissions, or human
  authority with a centralized workflow model.
- Building a standalone agent runtime, model and tool loop, skill loader,
  generic plugin marketplace, database-backed service, distributed scheduler,
  transaction coordinator, rollback engine, compensation engine, or alert
  router.
- Treating Staged Self-Application as empirical proof of teaching effectiveness,
  adapter fitness, runtime necessity, performance, security, or production
  reliability.
- Supporting hosts or portability claims beyond the capabilities exercised by
  real adapters in declared Clean-Session Runs.
- Adding cryptographic signatures inside the trusted local version-one
  boundary before an untrusted transport exists.
- Claiming power-loss durability, distributed concurrency, performance,
  migration, canary, or sustained-production behavior without the matching
  Evidentiary Ladder rung.
- Designing generic orchestration for unrelated agent ecosystems before the
  Matt Pocock Skills and Ariadne use case passes its evidence gates.
- Implementing the Methodological Harness System as part of this specification.

## Further Notes

- The [completed Wayfinder map](map.md) and its 13 resolved decision tickets are
  the decision basis for this specification. The tickets include the user's
  confirmations of the testing seams, ownership boundaries, runtime safety,
  lifecycle, and deletion rules.
- The neutral Orchestration Harness boundary is structurally coherent, but a
  dedicated Orchestration Kernel remains a Decision-Significant Unknown until
  the matched Rung 6 thin-baseline comparison is complete.
- The kernel must be deleted or inlined if the thinner path satisfies every hard
  continuation invariant.
- Teaching effectiveness, transfer, validator mutation quality, owner-adapter
  conformance, and runtime safety remain open Evidence Requests. An
  inconclusive result keeps the affected claim open and does not authorize a
  larger architecture.
- Distribution across Codex, Gemini, Claude Code, and other hosts remains
  limited to the capability contracts exposed and tested by real adapters.
