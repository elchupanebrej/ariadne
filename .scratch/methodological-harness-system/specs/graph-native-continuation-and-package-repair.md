# Spec — Graph-Native Frame Continuation and Pre-First-Publish Package Repair

Triage: `ready-for-agent`

Derived from: ticket 14 (research, resolved) —
`issues/14-research-graph-native-harness-contract.md` and its answer document
`docs/research/graph-native-harness-contract.md`.

## Problem Statement

A fresh agent session that holds only a frame id cannot determine the one next
Ariadne operation to perform. `ariadne status` returns frontier lists without a
ranked next operation, and `ariadne report FRAME-id --json` returns only `file`,
`mode`, `sections`, `remainder_roots`, and `change_log` — no `next_action`,
`operation`, `command_or_template`, `dependencies`, or `unlocks`. This was
falsified empirically (`EVD-frame-continuation-prototype-r3`). Every cold start
or handoff therefore depends on hidden session memory or human narration, which
breaks deterministic continuation.

At the same time the package cannot be published cleanly: README, LICENSE file
and metadata, TypeScript declarations, `types`, and an `exports` map are all
absent (confirmed by `EVD-packed-install-contract-r6`), and teaching-module
star-exports make 28.8% of the tarball (260,109 B of 904,382 B) dead weight for
every consumer. Because the package has never been published, there is a
one-time window to fix the public surface without any release constraint.

## Solution

Deepen the existing `ariadne status` / `ariadne report` CLI path with an
explicit frame argument that projects a frame-scoped continuation from the
graph alone: the six readiness classes (open-evidence, unresolved-contradiction,
blocked-dependency, decision-ready, blocked, insufficient-information) are
derived from existing node types, `provenance_type`, terminality, dependencies,
and edge endpoint contracts, with a deterministic fail-closed-first priority
order that returns exactly one next operation per response. The projection
reads `GRAPH.jsonl` and writes nothing — no new mutable state, no persisted
spine, no runtime. Handoff stays pointer-only: the frame id is the complete
handoff.

Paired with this, repair the package surface before first publish: declarations
and `types`, an intentional `exports` map exposing only the retained thin-path
surfaces, root README and LICENSE, zero install scripts, removal of the
`teach-*` star-exports, and one repeatable pack-and-install smoke check that
proves a clean consumer can install the tarball, type-check a documented import,
and run the packaged `methodize-harness` checker.

## User Stories

1. As a fresh agent session, I want to pass a frame id to `ariadne status` and receive exactly one next operation, so that I can continue work deterministically without prior session context.
2. As a fresh agent session, I want the continuation response to name the operation's command or template, so that I can execute it without guessing invocation syntax.
3. As a fresh agent session, I want the continuation response to list unmet dependencies, so that I know what must advance before the recommended action is safe.
4. As a fresh agent session, I want the continuation response to list what the recommended action unlocks, so that I can plan beyond the immediate step.
5. As a fresh agent session working on a frame with an outstanding evidence request, I want continuation to direct me to execute the pinned method and record the evidence result, so that open evidence blocks downstream decisions.
6. As a fresh agent session working on a frame with an active contradiction, I want continuation to fail closed and direct me to resolve the contradiction first, so that I never build on poisoned derivations.
7. As a fresh agent session working on a frame with an unmet dependency, I want continuation to name the deepest unsatisfied dependency, so that I unblock the highest-priority candidate efficiently.
8. As a fresh agent session working on a decision-ready frame, I want continuation to direct me to record the decision with its satisfies/answers edges, so that readiness converts into a locked decision without extra orientation.
9. As a fresh agent session working on a frame full of unverified assumptions, I want continuation to report insufficient-information and direct me to raise explicit unknowns and an evidence request, so that I never guess.
10. As a fresh agent session working on a fully blocked frame, I want a structured diagnostic naming the blocker and a concrete fix instead of a recommendation, so that I can report precisely why progress is impossible.
11. As a fresh agent session, I want tie-breaking to be deterministic (frame order, then node id), so that two sessions with the same pointer always derive the same next action.
12. As a session handing off mid-frame, I want to leave only the frame id in a ticket or skill text, so that handoff is complete without copying reports or state.
13. As an agent orchestrating multiple skills, I want continuation to read only the existing graph, so that no second durable state file can drift from Ariadne's authority.
14. As a method-skill user, I want the teaching modules gone from the installed package, so that `node_modules` does not carry 28.8% of content I can never call.
15. As a package consumer, I want TypeScript declarations and a `types` entry, so that documented imports type-check in my project.
16. As a package consumer, I want an intentional `exports` map, so that the public surface is exactly the retained thin-path API and nothing accidental.
17. As a package consumer, I want a README and LICENSE in the tarball, so that I can evaluate and legally use the package.
18. As a package consumer, I want the package to ship prebuilt JavaScript with zero install-time scripts, so that installation works under npm 12, pnpm ≥10, and Yarn ≥4.14 defaults.
19. As a maintainer preparing the first publish, I want the `teach-*` star-exports removed from the root export surface now, so that removing them later never requires a major release.
20. As a maintainer, I want the thin-path modules (attempt, controller, release-bundle, self-application) retained untouched, so that the crash-safe attempt seam and pinned contracts keep working.
21. As a maintainer, I want one repeatable pack-and-install smoke check, so that package portability is verified the same way every time instead of ad-hoc.
22. As a maintainer, I want the continuation contract to pass a table-driven check before any DEC lock is recorded, so that the design is not locked on unimplemented prose.
23. As a future host-integration author, I want this spec to make no host-integration claim, so that the Rung 6 obligation for a real-host contract test stays explicit and unmet.

## Implementation Decisions

- **Deepen, don't add.** The continuation projection is reached through the
  existing `ariadne status <FRAME-id>` and `ariadne report <FRAME-id> --json`
  CLI paths. No new command, no new seam.
- **Pure projection.** Readiness rules evaluate at invocation time over the
  subgraph induced by the frame through the existing edge types (`derived_from`,
  `satisfies`, `answers`, `tests`, `supports`, `falsifies`, `contradicts`,
  `depends_on`, `references`; direct plus transitive), intersected with
  non-terminal nodes per the existing frontier predicate. The projection reads
  the materialized graph and writes nothing.
- **Readiness logic placement.** The readiness/priority logic lives as a pure
  function over the materialized graph plus frame id, colocated with the
  existing status report builder's level; the CLI command files stay thin.
- **Six readiness classes** derived from existing semantics only:
  - `blocked-contradiction`: active contradiction node with a `contradicts` edge
    to a live proposition, or merge-conflict status (already surfaced by the
    status report).
  - `blocked-evidence`: an active evidence request not answered by a SUPPORTED
    evidence result via an `answers` edge, or `required_rung` above the highest
    rung among its answering evidence results.
  - `blocked-dependency`: a non-terminal candidate whose dependency ids (or
    `depends_on` edge targets) include a non-terminal, non-superseded node.
  - `ready`: a candidate whose supporting value/evidence edges are all
    SUPPORTED/validating, with no active contradicts/invalidates/falsifies edge
    and no decision node joined by `answers`/`satisfies`.
  - `insufficient-information`: subgraph nodes with UNKNOWN or ASSUMED
    provenance lacking any `tests`/`falsifies` edge from an evidence result and
    not covered by an evidence request.
  - `blocked`: every candidate path crosses an unresolved contradiction, an
    invalidated/superseded node, or a missing owner receipt.
- **Fail-closed priority order** (exactly one operation per response):
  1. `blocked-contradiction`
  2. `blocked-evidence`
  3. `blocked-dependency`
  4. `ready`
  5. `insufficient-information`
  A fully `blocked` frame emits a structured diagnostic (severity, code,
  message, target, fix) and no recommendation.
- **Deterministic tie-breaking**, stateless: frame `derived_from` order, then
  lexicographic node id. Ties return the first action and list the runner-up in
  `unlocks` — never two actions.
- **Continuation response shape** (OpenSpec §4.4-derived): `next_action`,
  `operation`, `command_or_template`, `dependencies` (as `missingDeps` where
  applicable), `unlocks`. The report JSON gains these fields; the status report
  gains the continuation block when a frame argument is supplied.
- **Pointer-only handoff.** The frame id is the complete handoff. The persisted
  active-frame spine stays deferred; no STATE.md-style second state file.
- **Retained thin-path API untouched:** attempt, controller, release-bundle,
  and self-application modules keep their current surfaces and do not enter the
  default `exports` map beyond what they already need.
- **Package repair, pre-first-publish:**
  - `types` pointing at built declarations; build emits declarations.
  - Intentional `exports` map: at minimum `"."` with `types`/`import`
    conditions, plus `"./cli"` if deep import matters — exposing only the
    retained class-(c) surfaces.
  - Root `README.md` and `LICENSE` (both FAIL in the Rung 6 check).
  - Zero install-time scripts; prebuilt JS in the tarball via the existing
    `prepack` build.
  - Remove the `teach-*` star-exports from the root export surface and exclude
    teaching modules from the published runtime. Package unpublished, so no
    release constraint applies today.
- **Pack smoke check script:** `npm pack` → clean temporary consumer →
  `npm install <tarball>` → type-check a documented import → run the packaged
  `methodize-harness` example checker. Promotes the ad-hoc
  `EVD-packed-install-contract-r6` receipt into one repeatable script.
- **No DEC lock** on the continuation contract until the Rung 3 table-driven
  check passes; the lock becomes eligible only then.

## Testing Decisions

- **Good tests assert external behavior only:** the JSON emitted by the CLI and
  the pass/fail of the pack smoke check. No tests against internal readiness
  helpers, graph internals, or projection data structures.
- **Table-driven Rung 3 tests** over seeded graphs, one case per readiness
  class, plus: priority-order cases (e.g. contradiction outranks outstanding
  evidence), tie-break cases (declaration order, then node id), the blocked
  diagnostic envelope, and an absent/unknown frame id case. Each case asserts
  exactly one next action and the full response field shape.
- **Determinism check:** the same seeded graph and frame id produce the same
  continuation across runs.
- **Package test:** the pack smoke check script itself; it passes when the
  clean-consumer install, typed import, and packaged checker run succeed —
  measured after the exports/types/README/LICENSE repair, not before.
- **Prior art:** existing CLI command tests under `tests/` (per-command suites
  driving argument parsing and JSON output), the packed-install receipt from
  `EVD-packed-install-contract-r6`, and the no-kernel import-allowlist test
  guarding thin-path retention.

## Out of Scope

- The persisted active-frame orientation spine — deferred until pointer-only
  handoff demonstrably fails.
- A dedicated orchestration runtime, scheduler, queue, session database, or
  agent-wave engine.
- Host-owned responsibilities inside Ariadne: sessions, permissions, retries,
  compaction, snapshots.
- The real-host adapter contract test (dispatch intent → permission decision →
  crash-after-intent single disposition → cancellation acknowledgment) — a
  separate follow-up; no host-integration claim is made by this spec.
- A generic multi-host adapter framework.
- Any work on the teaching simulators, including a new one.
- Removal of the pinned thin-path modules.
- Actually publishing to npm.

## Further Notes

- Full derivation, receipts, and falsification predicates:
  `docs/research/graph-native-harness-contract.md`. Key evidence:
  `EVD-peer-repository-harness-patterns`, `EVD-frame-continuation-prototype-r3`,
  `EVD-packed-install-contract-r6`, `EVD-graph-native-harness-contract-r1`.
- Falsification predicates to respect during implementation: graph-only
  continuation fails if implementing the priority rules requires state beyond
  `GRAPH.jsonl`; package portability fails if the smoke check fails after the
  repair; teaching-runtime deletion fails if any supported consumer of a deleted
  symbol breaks or teaching-support coverage is lost.
- The four pinned thin-path modules and the `methodize-harness` skill example
  are the retained supported surfaces; the skill example uses only `node:`
  builtins and must keep passing from inside the installed tarball.
