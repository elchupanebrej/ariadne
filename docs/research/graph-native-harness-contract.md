# Graph-Native Harness Contract — Minimum Continuation and Portable Release

Date: 2026-09-03
Ticket: `.scratch/methodological-harness-system/issues/14-research-graph-native-harness-contract.md`
Method: static analysis of pinned primary sources plus reproducible local receipts from the
current worktree. Evidence rung: 1–3 (no host-integration claim is made).

## Question 1 — Can existing graph relationships determine exactly one next operation, without a workflow engine?

**Yes, for the four representative frame classes, using only existing Ariadne node and edge
semantics.** The evidence:

1. **Peer proof by construction.** OpenSpec's agent contract
   ([agent-contract.md §4.4–4.5](https://github.com/Fission-AI/OpenSpec/blob/a0ddb60d040c61f4907436a9d91310934b1dda63/docs/agent-contract.md))
   derives ordered readiness (`done | skipped | ready | blocked`), direct dependencies
   (`requires`, `missingDeps`), dependency-ordered recommendation, and `unlocks` from artifact
   existence plus a declarative dependency graph — no scheduler, no workflow state. Its
   implementation keeps "completion intentionally boring: artifact existence determines
   completion" (`src/core/artifact-graph/state.ts`, pinned revision). This is exactly the shape
   Ariadne's gap requires.
2. **Ariadne's graph already carries the needed semantics.** Verified against
   `src/core/types/nodes.ts` and `src/core/schemas/edges.ts` (this worktree):
   - Node types: `FRAME, OBS, CLM, HYP, CTR, SPACE, CAN, UNK, ASM, DEP, DYN, VAL-SELECT, EVDREQ,
     EVD, VAL, TRANS, DEC, STATE, HANDOFF, LEAN-TASK, TASK`.
   - Node fields: `provenance_type` (`UNKNOWN … DECIDED`), `status`, `dependencies`, `falsification_conditions`; `EVD.verdict` (`SUPPORTED | FALSIFIED | INCONCLUSIVE`), `EVD.rung`, `EVD.receipt`; `EVDREQ.claim/candidate/required_rung/pass_condition/fail_condition`.
   - Edge types with enforced endpoint contracts: `supports, contradicts, depends_on,
     derived_from, answers, tests, falsifies, invalidates, satisfies, violates, supersedes,
     references`.
   - Frontier/terminality is already a pure function: `isFrontierNode` /
     `TERMINAL_NODE_STATUSES` in `src/graph/storage.ts:152-179` (tombstone, `DECIDED`
     provenance, or status ∈ {RESOLVED, REJECTED, INVALIDATED, REMOVED, DECIDED}).
3. **The gap is real but narrow.** `EVD-frame-continuation-prototype-r3` (FALSIFIED, Rung 3)
   measured that `ariadne report FRAME-id --json` returns only `file, mode, sections,
   remainder_roots, change_log` — no `next_action`, `operation`, `command_or_template`,
   `dependencies`, or `unlocks`. Confirmed in this worktree: `src/cli/commands/report.ts:54-62`
   emits exactly those fields; `src/cli/commands/status.ts:64-126` returns frontier lists and
   merge-conflict guidance but no ranked next operation.

### Frame-continuation readiness and priority rules (existing semantics only)

All rules below are evaluated at invocation time over the subgraph induced by a frame
`FRAME-F`: the set of nodes connected to `F` through `derived_from`, `satisfies`, `answers`,
`tests`, `supports`, `falsifies`, `contradicts`, `depends_on`, and `references` edges (direct
plus transitive), intersected with non-terminal nodes per `isFrontierNode`. No new mutable
state is read or written.

**Node readiness predicates** (each returns ready / blocked / insufficient-information):

| Frame class | Existing semantics observed | Derived readiness | One next operation |
|---|---|---|---|
| **Open-evidence frame** | An active `EVDREQ` (non-terminal, not answered by a `SUPPORTED` EVD via an `answers` edge, or `required_rung` greater than the highest rung among its answering EVDs) | `blocked-evidence` | Execute the EVDREQ's pinned method and record the EVD (the EVDREQ's `pass_condition`/`fail_condition` supply the check). |
| **Unresolved-contradiction frame** | An active `CTR` node in the subgraph with a `contradicts` edge to a live proposition (`CLM`/`CAN`/`ASM`), or a node with merge-conflict status (already surfaced by `status.ts` merge_conflicts) | `blocked-contradiction` | Resolve the contradiction first (card guidance already exists); all other operations on shadowed subjects are unsafe. |
| **Blocked-dependency frame** | A non-terminal candidate whose `dependencies` ids (or `depends_on` edge targets) include a non-terminal node that is not superseded | `blocked-dependency` | Advance or satisfy the deepest unsatisfied dependency; the response names it as `missingDeps` (OpenSpec §4.4 shape). |
| **Decision-ready frame** | A `CAN` whose supporting `VAL`/`EVD` edges are all `SUPPORTED`/validating, with no active `contradicts`/`invalidates`/`falsifies` edge, and no `DEC` node joined by an `answers`/`satisfies` edge | `ready` | Record the decision: append the `DEC` and its `satisfies`/`answers` edges (the decision-scope gate applies). |
| **Insufficient-information outcome** | Subgraph nodes with `provenance_type: UNKNOWN` or `ASSUMED` lacking any `tests`/`falsifies` edge from an EVD, and no EVDREQ covering them | `insufficient-information` | Raise the explicit `UNK`/`ASM` node plus one `EVDREQ`; do not guess. |
| **Blocked outcome** | Every candidate path crosses an unresolved contradiction, an invalidated/superseded node, or a missing owner receipt | `blocked` | Return one structured diagnostic naming the blocker and a concrete fix (OpenSpec diagnostic envelope: severity, code, message, target, fix); emit no recommendation. |

**Priority order (exactly one operation per response):**

1. `blocked-contradiction` — fail closed; contradictions poison every downstream derivation.
2. `blocked-evidence` — an outstanding EVDREQ on an otherwise-decided claim.
3. `blocked-dependency` — unmet dependency of the highest-priority candidate.
4. `ready` — record the decision.
5. `insufficient-information` — raise unknowns before pretending readiness.

Tie-breaking is deterministic and stateless: OpenSpec-style declaration order (frame
`derived_from` order), then lexicographic node id. If two candidates tie on readiness class,
the response returns the first and lists the runner-up in `unlocks` — it never returns two
actions.

This is a projection, not an engine: the rules read `GRAPH.jsonl` and write nothing. That
satisfies `CAN-graph-native-frame-continuation`'s `no new mutable state` invariant by
construction.

## Question 2 — Is an explicit frame pointer sufficient for cold start and handoff?

**Yes — pointer-only suffices, and no observed failure justifies persisted active-frame state
yet.**

- Matt Pocock Skills' invocation contract
  ([invocation.md](https://github.com/mattpocock/skills/blob/6654f6b60cd9d5be8b54c6fafe44346dabeb3b76/.agents/invocation.md),
  pinned commit) makes dependencies name-based and handoffs pointer-only: "Dependencies are
  expressed as an explicit instruction to call the Skill tool with the named skill … not deep
  `../other-skill/FILE.md` cross-references." The handoff skill "is deliberately a pointer to
  existing artifacts, not another copy." The Ariadne graph *is* the authoritative artifact, so
  a frame id in a ticket, map, or skill text is a complete handoff.
- The orientation failure that motivated `CAN-persisted-active-frame-spine` — `ariadne status
  --json` returning 94 frontier nodes with no active frame (recorded in
  `EVD-peer-repository-harness-patterns`) — is a **rendering** gap cured by deepening
  `status`/`report` with an explicit frame argument, not a state gap. Deepening the projection
  removes the last structural advantage of a persisted spine for the observed use case.
- `CAN-persisted-active-frame-spine`'s own payload lists the costs: mutable derived state, a
  freshness policy, concurrent-frame races, and "graph mutation succeeds but snapshot update
  fails." OpenGSD's `STATE.md`
  ([state-md.md](https://github.com/open-gsd/gsd-core/blob/86452da7cb4d23147e850b1758214d9f9b86818d/docs/reference/state-md.md),
  pinned commit) shows a spine is *buildable* — active_phase, next_action, next_phases,
  stopped_at, resume priority — but GSD needs it because its workflow steps are not derivable
  from a single durable graph the way Ariadne's are. Borrowing it would duplicate authority
  (the peer comparison already rejects "a second `STATE.md` workflow model").

**What observed failure would justify a spine:** evidence that sessions routinely work multiple
frames concurrently with no human- or ticket-supplied pointer, *and* that frame-scoped
derivation from the graph alone cannot select a correct single focus (the spine card's own
falsification predicate, inverted). Until such evidence exists, the spine stays deferred.

## Question 3 — Teaching-export consumer audit (who can be deleted, what is retained)

### Receipts (commands run in this worktree, 2026-09-03)

- `grep -rn "teach-harness|teach-ariadne|teach-methodology" src/ tests/ scripts/ docs/ package.json .agents/`:
  the only importers of `src/teach-harness/*` are `src/index.ts:44` (root star-export) and
  `tests/teach-harness/{teaching-session,transfer-and-recovery}.test.ts`. Same pattern for
  `teach-ariadne` and `teach-methodology` (root star-export + their own test files only).
  No script, skill, doc, or CLI command imports any teaching symbol.
- The shipped skill example `.agents/skills/methodize-harness/example/check.mjs` imports only
  `node:fs`, `node:path`, `node:url` — it does **not** use the teaching runtime.
- `src/harness/release-bundle.ts` (332 lines) and `src/harness/self-application.ts` (385
  lines): importers are their test files plus the thin-path allowlist in
  `tests/harness/no-kernel.test.ts:25`. No runtime caller.
- `src/harness/attempt.ts` (718 lines): tests + a real child-process seam
  (`tests/harness/attempt.test.ts:26`, `effect-safety.test.ts:264`) exercise the built module.
  `src/harness/controller.ts` (145 lines): imported by `src/cli/commands/ingest.ts:5` and e2e
  tests.
- Line counts (`wc -l`): `src/teach-harness/` = 2,626 lines (session 1,092, verifier 821,
  staged-self-application 335, issue-triage 366, types 359); `src/teach-ariadne/` = 1,699;
  `src/teach-methodology/` = 2,083; `src/harness/` = 1,580.
- Package measurement (`npm pack --dry-run --json`): **129 files, 904,382 bytes total; 18
  `teach-*` files, 260,109 bytes = 28.8%** of the tarball. This refines (and confirms within
  drift) the earlier "~3,000 lines / ~31%" figures in `EVD-peer-repository-harness-patterns` —
  the worktree has moved slightly since 2026-08-30.

### Audit table

Classification key: **(a) safe deletion** — only self/test callers; **(b) major-release-only**
— external-facing export; **(c) retained supported API** — direct Ariadne / method-skill
callers.

| Surface | Lines | Callers found | Class | Disposition |
|---|---|---|---|---|
| `src/teach-harness/*` | 2,626 | root star-export + own tests only | (a) today, (b) after first publish | Delete from the published runtime or move under a non-exported path; drop the root star-export **before** the first npm publish (see Q4). |
| `src/teach-ariadne/*` | 1,699 | root star-export + own tests only | (a) today, (b) after first publish | Same. |
| `src/teach-methodology/*` | 2,083 | root star-export + own tests only | (a) today, (b) after first publish | Same. |
| `src/index.ts` star-exports of `teach-*` | — | external package surface | (b) | Removing them from `exports`-visible surface requires a major release **once published**; pre-publication it is free. |
| `src/harness/release-bundle.ts` | 332 | tests + `no-kernel.test.ts` allowlist | (c) | Retained: ticket-16 addendum pins it as a thin-path module (release-bundle registry); no runtime caller, so it must not enter the default `exports` map. |
| `src/harness/self-application.ts` | 385 | tests + allowlist | (c) | Retained: ticket-15 addendum pins it as the immutable staged-self-application round runner; keep internal. |
| `src/harness/attempt.ts` | 718 | tests incl. child-process seam; `no-kernel.test.ts` import-allowlist | (c) | Retained: the crash-safe attempt seam; all 10 hard continuation invariants supported (`.scratch/…/evidence/14-kernel-branch-disposition.md`). |
| `src/harness/controller.ts` | 145 | `src/cli/commands/ingest.ts`, e2e tests | (c) | Retained. |
| `.agents/skills/methodize-harness/` (example + checker) | — | self-contained (`node:` builtins only) | (c) | Retained: this is the supported method-skill surface; it passed the Rung 6 packed-install check (`EVD-packed-install-contract-r6`). |

Key structural finding: **the package has never been published to npm** —
`docs/research/npm-delivery.md` verified `ariadne-reasoning` was free on 2026-08-25, and the
registry name remains unclaimed. That means the (b) class is currently empty *in practice*:
today every teaching export can be removed without any release-constraint, provided the
export trim lands before the first publish. After the first publish, root star-exports of
teaching symbols become breaking-removal (major) territory.

## Question 4 — Minimum documented, typed package surface and external pack contract

Current state (verified in this worktree): `package.json` already has `name:
ariadne-reasoning`, `bin` (both `ariadne` and `ariadne-reasoning`), a `files` whitelist
(`dist`, `.agents`, `scripts`), `engines.node >=20`, repository/homepage/bugs metadata, and a
`prepack` build. `EVD-packed-install-contract-r6` (FALSIFIED, Rung 6) found install and the
packaged `methodize-harness` example pass, while README, license file + metadata,
declarations, `types`, and an `exports` map are absent — all still true in this worktree.

Minimum contract that preserves direct Ariadne and method-skill use:

1. `types: "./dist/index.d.ts"` + build declarations (unflagged today).
2. An intentional `exports` map — at minimum `"."` with `types`/`import` conditions, plus
   `"./cli"` if deep import matters — exposing **only** the retained class-(c) surfaces; the
   `teach-*` star-exports leave the visible surface before first publish.
3. Root `README.md` and `LICENSE` (license file + metadata were both FAIL in the Rung 6 check).
4. No install-time scripts: npm-delivery research (npm 12 blocks dependency install scripts by
   default; pnpm ≥10 and Yarn ≥4.14 likewise) requires a fully static package; ship prebuilt
   JS in the tarball (the existing `prepack` build already does this for the publisher side).
5. The external pack contract is the one already demonstrated in
   `EVD-packed-install-contract-r6`: `npm pack` → clean temporary consumer → `npm install
   <tarball>` → type-check a documented import → run
   `node_modules/ariadne-reasoning/.agents/skills/methodize-harness/example/check.mjs`.
   Promote that ad-hoc receipt into one repeatable smoke check script.

This matches `CAN-portable-minimal-release-contract` ("publish only intentional typed entry
points and portable skills") and the npm-delivery findings (pure static package: `bin` +
`files` + `engines`, zero lifecycle scripts).

## Question 5 — The single real-host adapter contract test

OpenCode's session layer
([session.ts, pinned commit; the `Info` schema and surrounding service](https://github.com/anomalyco/opencode/blob/10765ff2a9da8c3b88e4de873aa383a49c318912/packages/opencode/src/session/session.ts))
shows the host owns: the durable session database (`SessionTable`, drizzle), permission
rulesets (`PermissionV1.Ruleset`, `setPermission`), revert/snapshot state (`Revert` with
snapshot + diff), compaction timing (`time.compacting`), and session lifecycle events
(`EventV2Bridge` publishes Created/Updated/Deleted). Ariadne must never absorb these; its
library-side subset is `src/harness/attempt.ts` (intent before effect, durable pending
decision, explicit recovery outcomes).

**The one required test:** a single contract test against **one real supported host adapter**
that drives the existing attempt protocol across a real process boundary and asserts, in
order:

1. dispatch intent is durably recorded before the host tool executes;
2. a host permission decision (approval or denial) is observed and recorded by the adapter;
3. a crash after intent (process killed between intent and effect) yields **exactly one**
   disposition on resume, resolved only by an owner receipt;
4. a host-issued cancellation resolves to acknowledgement of the recorded intent.

Until that test passes against a real host, **no host-integration claim is admissible** (this
is the Rung 6 obligation already noted in `DEC-matt-ariadne-adapter-contract` and the peer
comparison's "prove, do not absorb" section). No generic multi-host adapter framework may be
built in anticipation.

## Falsification predicates

- **Graph-only continuation** (refines `CAN-graph-native-frame-continuation`'s predicate):
  falsified if a fresh session given only the frame id and one JSON response cannot identify
  and execute the correct next Ariadne operation for any of the six readiness classes above;
  or if implementing the priority rules requires state beyond `GRAPH.jsonl` (e.g. a stored
  cursor, a workflow-phase field, or cross-frame sequencing memory) to pick the one action.
- **Pointer-only handoff**: falsified if a cold-start session holding only the frame id cannot
  reconstruct readiness within one bounded response, or if two sessions with the same pointer
  derive different next actions (nondeterminism), or if a real concurrent multi-frame workflow
  demonstrably cannot express its focus as a pointer.
- **Teaching-runtime deletion**: falsified if any supported consumer (a published-package
  importer, a shipped skill, a script, or a doc-documented example) imports a deleted symbol
  and breaks; or if teaching tests cannot be repointed to fixtures/skills without losing the
  Rung 3 teaching-support coverage recorded in `.scratch/…/evidence/17-clean-session-support-matrix.md`.
- **Package portability** (refines `CAN-portable-minimal-release-contract`'s predicate):
  falsified if `npm install <tarball>` into a clean temporary project fails, or a documented
  typed import does not type-check, or the packaged `methodize-harness` example checker fails
  outside the repository — measured after the exports/types/README/LICENSE repair, not before.
- **Host-adapter claims**: falsified by construction if any host-integration claim (Matt
  adapter, Ariadne adapter, or any third host) is made before the Question-5 contract test
  passes on a real host. Existing Rung 3 adapter lifecycle suites
  (`tests/adapters/*lifecycle.test.ts`) do **not** count.

## Local verification receipts

- `npm run verify` (typecheck + vitest): **PASS — 63 test files, 657 tests**, 2026-09-03.
- `ariadne verify --strict`: **PASS** (structural, semantic, epistemic gates, no diagnostics).
- `npm pack --dry-run --json`: 129 files / 904,382 B; teach files 18 / 260,109 B (28.8%).
- `grep` call-site audit: no non-test, non-star-export consumer of any `teach-*` symbol;
  no runtime caller of `release-bundle.ts` / `self-application.ts` outside the thin-path
  allowlist tests.

## Ranked recommendation (single)

**Rank 1 — deepen the existing `status`/`report` CLI path into the graph-native frame
continuation contract (implement `CAN-graph-native-frame-continuation`), and pair it with the
pre-first-publish package repair (typed `exports`, declarations, README/LICENSE, teaching
star-exports removed) under `CAN-portable-minimal-release-contract`.** Concretely: one
research ticket to implement the six readiness classes and priority order of Question 1 over
the existing graph projection with table-driven Rung 3 tests; one packaging ticket for the
Question-4 surface plus the pack smoke check. Keep `attempt.ts`, `controller.ts`,
`release-bundle.ts`, and `self-application.ts` as-is. Defer the spine and the dedicated
runtime; no DEC lock is recorded here because the continuation contract remains an
unimplemented design — the recommendation becomes lock-eligible only after the Rung 3
table-driven check passes.

## Do-not-build list

- A persisted active-frame orientation spine (`CAN-persisted-active-frame-spine`) — stays
  deferred until pointer-only handoff demonstrably fails.
- A dedicated orchestration runtime, scheduler, queue, session database, or agent-wave engine
  (`CAN-dedicated-orchestration-runtime`) — the thin attempt path already satisfies all ten
  hard continuation invariants.
- A second durable state file (STATE.md-style) duplicating the graph's authority.
- Host-owned responsibilities inside Ariadne: sessions, permissions, retries, compaction,
  snapshots.
- A generic multi-host adapter framework built ahead of a real host contract test.
- A new teaching simulator (including one explaining the existing teaching simulators).
- Any removal of `attempt.ts` / `controller.ts` / `release-bundle.ts` /
  `self-application.ts` — they are pinned thin-path modules.
