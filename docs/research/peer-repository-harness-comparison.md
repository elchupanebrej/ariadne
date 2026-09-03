# Harness Lessons from Peer Repositories

Date: 2026-08-30

## Question

How should Ariadne's harness improve when compared with Matt Pocock's skills,
OpenGSD, OpenSpec, and OpenCode, while using Ariadne itself to reason about the
decision?

## Scope and method

This is a static comparison of the following revisions:

- Matt Pocock skills: `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`
- OpenGSD (`next`): `86452da7cb4d23147e850b1758214d9f9b86818d`
- OpenSpec: `a0ddb60d040c61f4907436a9d91310934b1dda63`
- OpenCode: `10765ff2a9da8c3b88e4de873aa383a49c318912`

The repositories were inspected as primary sources. Local Ariadne measurements
were taken from the current worktree and `npm pack --dry-run --json`. This is
Rung 1 evidence: adequate for choosing a design direction, not for claiming a
production integration with any host.

## Ariadne baseline

The useful runtime seam already exists:

- `src/harness/attempt.ts` owns crash-safe intent recording, replay,
  cancellation, ambiguous-effect handling, and process-boundary recovery.
- `src/harness/controller.ts` projects capabilities, providers, and graph state
  for CLI and end-to-end callers.
- Existing process-boundary tests exercise the risky transition behavior.

The larger surface is not equally justified:

- `src/teach-harness/` is about 3,000 lines and exposes a large teaching-session
  API, but the shipped `methodize-harness` skill uses its own example checker
  and fixture rather than that runtime.
- `src/harness/release-bundle.ts` and `src/harness/self-application.ts` have no
  non-test runtime callers found in the current tree.
- The package root star-exports the teaching modules, making test and pedagogy
  machinery look like the primary library interface.
- A dry-run package contains 122 entries and about 775 KB unpacked. Generated
  `teach-*` JavaScript accounts for about 244 KB (roughly 31%). The package has
  no root README, LICENSE, declaration files, `types` entry, or `exports` map.
- The current Ariadne self-application exposed an orientation problem:
  `ariadne status --json` returned 94 frontier nodes but no active frame or
  recommended next action. `ariadne op knowledge` only selected a rule; the
  caller still had to inspect source and manually assemble records and edges.

The local verification command passed before this report was written.

## What the peers actually teach

| Repository | Useful pattern | Ariadne implication | Pattern not to copy |
|---|---|---|---|
| Matt Pocock skills | Small composable skills, an explicit invocation policy, name-based skill dependencies, and a tiny pointer-only handoff | Make each skill portable and let the handoff point to authoritative artifacts instead of copying them | A centralized workflow engine; the repository deliberately favors independent skills |
| OpenGSD | A compact state spine with active work, progress, stop point, and deterministic resume priority | Give a fresh session one bounded orientation result and one recommended action | GSD's project workflow ownership, phase scheduler, agent waves, and locking model |
| OpenSpec | A declarative artifact DAG plus deep `status`, `instructions`, and `validate` commands with structured diagnostics | Deepen Ariadne's existing graph/CLI seam so the next move is executable without reading implementation source | A parallel graph or a second orchestration runtime |
| OpenCode | Durable session events, intent before effects, explicit permission decisions, retry/compaction boundaries, and host-owned snapshots | Keep Ariadne's small attempt protocol and prove adapters against host contracts | Reimplementing the host's session database, permissions, retries, compaction, or snapshot system |

### Matt Pocock skills: portability over central control

The repository explicitly describes skills as small, adaptable, and composable,
and supports both subscription and editable-copy distribution
([README](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/README.md#L15-L27)).
Its invocation contract has one simple axis—user-invoked versus model-invoked—
with harness-specific metadata mirrored consistently
([invocation contract](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/.agents/invocation.md#L3-L10)).
Dependencies are named skills rather than deep relative file paths, while shared
references remain owned by the relevant skill
([dependency guidance](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/.agents/invocation.md#L14-L22)).
Its handoff skill is deliberately a pointer to existing artifacts, not another
copy of plans, specs, ADRs, issues, commits, or diffs
([handoff contract](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/skills/productivity/handoff/SKILL.md#L8-L14)).

For Ariadne, this makes the current repository-relative pins in method skills a
distribution defect. The repair is to make skill dependencies name-based or
skill-relative and keep the durable graph as the authoritative handoff target.

### OpenGSD: one orientation spine

OpenGSD treats `STATE.md` as a small file read at session start and updated after
meaningful actions. It combines machine-readable fields with a short human
digest
([STATE reference](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/docs/reference/state-md.md#L1-L15)).
The resume workflow reads the state and project once, detects handoffs,
checkpoints, incomplete work, and interrupted agents, then applies a stable
next-action priority
([resume loading](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/gsd-core/workflows/resume-project.md#L19-L60),
[resume priority](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/gsd-core/workflows/resume-project.md#L170-L215)).
Its architecture also makes the orchestrator thin: durable artifacts carry
context while fresh agents do specialized work
([context engineering](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/docs/explanation/context-engineering.md#L26-L65),
[orchestration loop](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/docs/explanation/multi-agent-orchestration.md#L21-L60)).

Ariadne should borrow only the orientation property. Its graph already owns the
durable state, so a second `STATE.md` workflow model would duplicate authority.

### OpenSpec: make the graph answer the next question

OpenSpec exposes a stable JSON envelope for each invocation and structured
diagnostics containing severity, code, message, target, and a suggested fix
([agent contract](https://github.com/Fission-AI/OpenSpec/blob/a0ddb60d040c61f4907436a9d91310934b1dda63/docs/agent-contract.md#L5-L23)).
Its status result orders artifact readiness and reports dependencies and next
steps; its instructions result returns the output path, context, rules,
template, dependencies, and unlocks for one artifact
([status and instructions](https://github.com/Fission-AI/OpenSpec/blob/a0ddb60d040c61f4907436a9d91310934b1dda63/docs/agent-contract.md#L58-L69)).
The implementation keeps completion intentionally boring: artifact existence
determines completion
([artifact state](https://github.com/Fission-AI/OpenSpec/blob/a0ddb60d040c61f4907436a9d91310934b1dda63/src/core/artifact-graph/state.ts#L6-L36)).

This is the closest match to Ariadne's actual gap. Ariadne does not need another
runtime. Its existing report/status path should turn the graph into a bounded,
actionable contract.

### OpenCode: respect the host boundary

OpenCode persists compact session metadata
([session model](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/packages/opencode/src/session/session.ts#L224-L244))
and publishes session lifecycle events
([session creation](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/packages/opencode/src/session/session.ts#L499-L537)).
Before tool execution it captures host state, while its processor distinguishes
errors, retries, and continuation. Permissions, retry policy, compaction, and
snapshots remain host responsibilities.

Ariadne's `attempt.ts` already implements the relevant library-side subset:
intent before effect, a durable pending decision, and explicit recovery
outcomes. Importing the rest of OpenCode would make Ariadne a competing agent
runtime. The missing evidence is a real adapter contract test, not a generic
adapter framework.

## Recommended shape

### P0 — make self-application navigable

Deepen one existing CLI path rather than adding a scheduler. Given an explicit
frame, `status` or `report` should return:

- the frame identity and unresolved decision-significant frontier;
- at most one recommended next node and operation;
- the exact command or record template needed to continue;
- dependencies and nodes unlocked by completion;
- structured diagnostics with a concrete fix when blocked.

Prefer an explicit frame argument first. Add persisted global focus only after a
real concurrent-frame use case proves that explicit selection is insufficient.

### P0 — repair the release and portability contract

- Add the package basics: README, LICENSE, declarations, `types`, and an
  intentional `exports` map.
- Replace repository-root and sibling-skill pins with name-based or
  skill-relative references.
- Add one pack-and-install smoke check that runs a method skill example outside
  the monorepo.

### P1 — remove duplicate teaching runtimes

Start with `src/teach-harness/`: its behavior is already represented more
directly by the method skill, fixture, and checker. Move any uniquely valuable
example into the skill and remove the simulator after checking published API
compatibility. Apply the same caller audit to the other `teach-*` modules and
to test-only `release-bundle` and `self-application` helpers.

This is a release decision if consumers already import the star-exported names;
do not silently remove them in a patch release.

### P1 — prove, do not absorb, host integration

Keep the attempt protocol. Add one contract test against a real supported host
adapter when such an adapter exists. The test should cover intent persistence,
approval or denial, ambiguous effect recovery, cancellation, and resume. Do not
add a generic interface solely to anticipate a second host.

## Explicit non-goals

Do not add:

- a workflow scheduler, queue, session database, or agent-wave engine;
- a second artifact graph or duplicated state file;
- provider retry, permission UI, compaction, or snapshot ownership;
- another teaching simulator to explain the existing teaching simulators.

## Acceptance checks

The direction is working when:

1. A fresh session can continue a named frame from one CLI response without
   reading Ariadne source or enumerating dozens of unrelated frontier nodes.
2. The response contains no more than one recommended next action and explains
   why it is ready or blocked.
3. A packed install exposes documented, typed entry points and the method skill
   example passes outside the repository.
4. Removing the unused teaching runtime materially reduces package surface
   without breaking an explicitly supported import.
5. Existing process-boundary attempt tests stay green, and a real adapter earns
   integration claims only after a host contract test passes.

## Follow-up validation receipts

Two local checks tested the proposed contracts against the current package:

1. A deterministic command-level example invoked `ariadne report
   FRAME-methodology-skill-harness-system --json` and required `next_action`,
   `operation`, `command_or_template`, `dependencies`, and `unlocks`. The
   current response contained only the report file, mode, section summary,
   remainder roots, and change log. The continuation contract is therefore
   **FALSIFIED on the current implementation at Rung 3**. This confirms the gap;
   it does not reject the proposed mechanism.
2. A tarball was built and installed into a clean temporary consumer project.
   Installation succeeded, and the packaged `methodize-harness` example checker
   passed all of its deterministic paths. The installed package lacked a root
   README, license file and metadata, declaration entry point, `types`, and an
   `exports` map. The complete portable release contract is therefore
   **FALSIFIED on the current package at Rung 6**, while the narrower claim that
   the harness example is self-contained is supported.

The temporary consumer project and tarball were removed after these receipts
were recorded.

## Verdict

The peer evidence supports a **thin, graph-native harness**. The highest-value
change is not a new orchestration runtime; it is a deeper continuation contract
on Ariadne's existing CLI, followed by portability and package cleanup. Preserve
the small crash-safe attempt seam, delete duplicate pedagogical runtime where
compatibility allows, and leave sessions, permissions, retries, and snapshots
to the host.
