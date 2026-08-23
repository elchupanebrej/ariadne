# Methodological Harness System

Label: `wayfinder:map`

## Destination

A decision-complete specification and dependency-wired decision map for: an Ariadne Teaching Skill with a complete worked example; a Methodology Authoring Teaching Skill; a Harness Authoring Teaching Skill grounded in current primary-source harness practice; a neutral Orchestration Harness complementing Matt Pocock Skills and Ariadne; and the methodology's self-harness. Implementation is handed off after the route is clear.

## Notes

- Consult Ariadne before each decision-significant branch. Ariadne owns the epistemic substrate; Wayfinder owns this decision map.
- Use `grilling` and `domain-modeling` for every grilling ticket, `research` for every research ticket, and `prototype` for every prototype ticket.
- Apply `docs/designing_methodological_guides.md`: meaningful task first, complete worked examples with all artifacts, progressive disclosure, verification, lifecycle, and self-application.
- Standing decisions: staged build-time bootstrap with acyclic runtime dependencies; a neutral Orchestration Harness as the provisional target; one compact versioned Method Contract as normative truth; the long guide owns rationale and provenance.
- The claim that a new runtime is necessary remains falsifiable. Research or a clean-session pilot may replace it with the thin-package fallback.
- Runtime, Matt skills, Ariadne, and the Method Contract retain separate ownership. Physical co-location does not merge domain ownership.
- Charting and ticket resolution produce decisions and specifications, not implementation.

## Decisions so far

- [Research modern agent harness construction](issues/01-research-modern-agent-harness-practices.md) — Primary sources support a falsifiable minimal neutral kernel for cross-session operational invariants, not a replacement agent framework.
- [Validate the neutral orchestration boundary with Ariadne](issues/02-validate-neutral-orchestration-boundary.md) — The ownership boundary is statically coherent at Rung 1; runtime necessity remains unproven and implemented adapters require Rung 6 evidence.
- [Decide the minimum Orchestration Harness contract](issues/03-decide-minimum-orchestration-contract.md) — Lock a host-neutral, pointer-only execution contract and allow only a minimal deletable kernel, never a standalone agent runtime.
- [Design the compact Method Contract](issues/04-design-method-contract.md) — Use one versioned JSON manifest with a closed envelope and embedded JSON Schema predicates; keep procedure effects bounded, external verification distinct from self-consistency, and rationale in linked guide anchors.
- [Design staged self-application and fixed-point verification](issues/05-design-staged-self-application.md) — Use owner-gated immutable bootstrap rounds; promote structural v1 only after two isolated complete applications agree that normalized `P/A/R/L` is unchanged, and stop on every delta, disagreement, pin, ownership, or cycle failure without consuming empirical evidence.
- [Design the Ariadne Teaching Skill and complete worked example](issues/06-design-ariadne-teaching-example.md) — Teach one task-first progressively routed parser decision, then require self-explanation, a faded case, a changed transfer route, and runnable checks while Ariadne and the Method Contract retain normative ownership.
- [Design the Methodology Authoring Teaching Skill](issues/07-design-methodology-authoring-skill.md) — Teach one contract-pinned task-first guide project: draft A0, expand A1–A7 only on observed signals, preserve live rationale links and separate receipts, practice targeted recovery, then transfer to non-recursive self-application.
- [Design the Harness Authoring Teaching Skill](issues/08-design-harness-authoring-skill.md) — Teach one failure-driven, source-pinned harness project: test the thin baseline first, add only triggered pointer-and-gate mechanisms, practice fail-closed recovery, and transfer through acyclic staged self-application.
- [Decide the Matt Pocock Skills and Ariadne adapter contracts](issues/09-decide-matt-ariadne-adapters.md) — Use one five-operation pointer-only lifecycle surface with owner-specific envelopes; preserve direct use and keep workflow, epistemic, host, method, and human state with their existing owners.
- [Decide runtime safety, observability, and recovery semantics](issues/10-decide-runtime-safety-and-recovery.md) — Require trusted-host, owner-gated, zero-default-replay semantics with atomic dispatch intent, pointer-only recovery and observability, and fail-closed owner-authoritative effects.
- [Decide clean-session verification and evaluation](issues/11-decide-clean-session-verification.md) — Use matched held-out Clean-Session Runs with audited inputs, non-compensatory Rung 5/6/8 evidence, independent fault and reviewer checks, and mandatory deletion when a thinner baseline passes.
- [Decide versioning, propagation, and retirement](issues/12-decide-versioning-and-lifecycle.md) — Keep owner-controlled versions and lifecycle authority, assemble exact tested tuples as immutable non-normative bundles, propagate changes through owner receipts, preserve attempt pins during migration, and retire only after executable absence and cleanup checks.
- [Decide kernel packaging and implementation substrate](issues/13-decide-kernel-packaging-and-substrate.md) — If the thin baseline cannot satisfy the contract, co-locate one optional neutral TypeScript kernel with a separate per-attempt JSONL ledger and local atomic file transactions; add no service or database, and delete or inline it when the baseline passes.

## Not yet specified

- Distribution across Codex, Gemini, Claude Code, or other hosts remains fog until the adapter boundary exposes which host capabilities are actually required.
- The final implementation handoff shape remains fog until the Method Contract, skills, adapter contracts, verification, and lifecycle decisions converge.

## Out of scope

- Implementing the runtime, skills, adapters, or validators during this Wayfinder effort.
- Treating self-consistency as empirical proof that the methodology or harness is effective.
- Replacing Matt Pocock Skills, Ariadne's epistemic graph, or the local issue tracker with a new workflow model.
- Designing generic orchestration for unrelated agent ecosystems before the Matt Pocock Skills + Ariadne use case is verified.
