# 14 — Research the minimum graph-native harness contract

**What to build:** Produce a decision-ready research update that determines the smallest Ariadne harness contract a fresh session needs for deterministic continuation and portable distribution. Start from the established peer comparison and Ariadne evidence below, test the remaining assumptions with primary sources and reproducible local receipts, and finish with a falsifiable recommendation. This ticket is research only: do not implement the continuation API, change package exports, or remove teaching modules.

**Blocked by:** None — can start immediately.

**Status:** resolved

**Type:** research

## Research seed

Treat these as the current evidence, not questions to rediscover:

- `EVD-peer-repository-harness-patterns` supports a thin, graph-native harness. OpenSpec is the strongest model for ordered status and artifact instructions; OpenGSD contributes only the compact resume-orientation pattern; Matt Pocock Skills contributes portable name-based dependencies and pointer-only handoff; OpenCode defines the host-owned boundary for sessions, permissions, retries, compaction, and snapshots.
- `EVD-frame-continuation-prototype-r3` falsified the current continuation contract: a frame-scoped report does not return `next_action`, operation, command or template, dependencies, or unlocks.
- `EVD-packed-install-contract-r6` found that a clean consumer can install the tarball and run the packaged `methodize-harness` checker, while README, license metadata and file, declarations, `types`, and an `exports` map are absent.
- `CAN-graph-native-frame-continuation` is the provisional continuation choice because it derives one action from the existing graph without new mutable state.
- `CAN-persisted-active-frame-spine` is deferred until evidence shows that a pointer-only handoff carrying an explicit frame is insufficient.
- `CAN-dedicated-orchestration-runtime` is not justified for the observed orientation gap. Preserve the existing crash-safe attempt seam, but do not move host lifecycle responsibilities into Ariadne.
- `CAN-portable-minimal-release-contract` is the companion candidate. Teaching runtime removal remains conditional on a public-consumer compatibility audit.
- Current local measurements found roughly 3,000 lines in the harness teaching simulator and about 31% of packed JavaScript in generated teaching modules, with no non-test runtime caller found during the initial call-site inspection.

Primary-source starting points:

- [Matt Pocock Skills invocation and dependency contract](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/.agents/invocation.md#L3-L22)
- [OpenGSD state and resume contract](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/docs/reference/state-md.md#L1-L15)
- [OpenSpec agent contract](https://github.com/Fission-AI/OpenSpec/blob/a0ddb60d040c61f4907436a9d91310934b1dda63/docs/agent-contract.md#L5-L69)
- [OpenCode session ownership boundary](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/packages/opencode/src/session/session.ts#L224-L244)

## Questions to resolve

1. Can the existing graph relationships determine exactly one next operation for representative open-evidence, unresolved-contradiction, blocked-dependency, and decision-ready frames without embedding a workflow engine?
2. Is an explicit frame pointer sufficient for cold start and handoff, and what observed failure would justify persisted active-frame state?
3. Which teaching exports have supported consumers, and which simulator or helper surfaces can be removed or moved out of the published runtime without an accidental breaking release?
4. What is the minimum documented, typed package surface and external pack contract that preserves direct Ariadne and method-skill use?
5. What single real-host adapter contract test would be required before claiming host integration, while leaving permissions, retry, compaction, sessions, and snapshots with the host?

- [x] Produce an English research note that answers all five questions using pinned primary sources, current call-site evidence, and reproducible local commands or receipts.
- [x] Define the frame-continuation readiness and priority rules over existing Ariadne node and edge semantics, including blocked and insufficient-information outcomes, without adding new mutable state.
- [x] Record a consumer and package-surface audit that separates safe deletion, major-release-only removal, and retained supported API.
- [x] State explicit falsification predicates for graph-only continuation, pointer-only handoff, teaching-runtime deletion, package portability, and host-adapter claims.
- [x] Update the relevant Ariadne unknowns, evidence results, candidates, and provisional selection; finish with all strict Ariadne gates green and no unsupported `DEC` lock.
- [x] End with one ranked recommendation and a concise do-not-build list; leave implementation as follow-up work rather than expanding this research ticket.

## Answer

Note: `docs/research/graph-native-harness-contract.md`. Graph evidence:
`EVD-graph-native-harness-contract-r1` (SUPPORTED, Rung 3, `answers`
`EVDREQ-peer-repository-harness-patterns`, `tests` all four candidates).

1. **Yes** — six readiness classes (open-evidence, unresolved-contradiction,
   blocked-dependency, decision-ready, blocked, insufficient-information) are derivable from
   existing node types, `provenance_type`, `isFrontierNode` terminality, `dependencies`, and
   edge endpoint contracts, with a deterministic fail-closed-first priority order. OpenSpec
   proves the shape; `EVD-frame-continuation-prototype-r3` confirmed the current report JSON
   lacks every continuation field.
2. **Pointer-only handoff suffices.** The observed failure (unbounded status frontier) is a
   projection gap, not a state gap; `CAN-persisted-active-frame-spine` stays deferred until
   concurrent multi-frame sessions without a pointer supplier are observed.
3. Audit: `src/teach-harness/` (2,626 lines), `teach-ariadne/` (1,699), `teach-methodology/`
   (2,083) have no non-test, non-star-export consumer → safe deletion **pre-first-publish**
   (package unpublished), major-release-only after. `attempt.ts`, `controller.ts`,
   `release-bundle.ts`, `self-application.ts` are retained thin-path API. Pack measurement:
   teach files = 260,109 B of 904,382 B (28.8%).
4. Minimum surface: declarations + `types`, intentional `exports` map, README, LICENSE, zero
   install scripts, plus the demonstrated pack-and-install smoke check.
5. One contract test against one real host adapter: dispatch intent before effect → host
   permission decision → crash-after-intent yields exactly one disposition via owner receipt →
   cancellation acknowledgment. No host-integration claim before it passes.

**Ranked recommendation:** implement graph-native frame continuation (deepen
`status`/`report` with explicit frame argument) paired with the pre-first-publish package
repair; defer spine and dedicated runtime; no DEC lock until the Rung 3 table-driven check
passes.

Receipts: `npm run verify` PASS (63 files / 657 tests); `ariadne verify --strict` PASS; all
four pinned primary-source URLs resolved (no 404s).

## Comments

Follow-up spec published from this ticket's answer:
`specs/graph-native-continuation-and-package-repair.md` (ready-for-agent).
