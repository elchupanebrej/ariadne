# Clean-Session Support Matrix — Ticket 17 (release-level)

**Scope rule:** this declaration names only environments and claims backed by achieved evidence. Anything wider is listed under "Unadvertised" and must stay unadvertised until evidence exists.

## Environments actually exercised

| Dimension | Values exercised | Evidence seam |
| --- | --- | --- |
| Host/process | Node v26 single process; spawned child processes (`spawnSync`) for cold-start/mid-run/dispatch-intent seams | `tests/harness/attempt.test.ts`, `tests/harness/effect-safety.test.ts` |
| Filesystem | Same-volume disposable temp workspaces (append-only JSONL ledgers) | `tests/harness/attempt.test.ts`, `tests/harness/attempt-fail-closed.test.ts` |
| Adapters | Matt owner adapter; Ariadne owner adapter (shared lifecycle contract) | `tests/adapters/matt-lifecycle.test.ts`, `tests/adapters/ariadne-lifecycle.test.ts` |
| Models | Deterministic fixtures only — no live model calls are made or claimed | every suite |
| Isolation auditor | Vitest isolation + per-test disposable workspace creation asserted in-suite | `tests/harness/effect-safety.test.ts` |

## Claim matrix

Verdict scale: supported / falsified / inconclusive. Rungs per spec Testing Decisions: deterministic = Rung 2–3; validator strength = Rung 5; teaching/conformance/kernel-necessity clean-session = bounded Rung 6; production safety = Rung 8.

| Claim area | Claim | Combos exercised | Rung | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| Teaching | Ariadne Teaching Skill teaches through parser path incl. faded query + changed duplicate route | 1 host × 1 skill | 3 (+6 in-process) | supported | `tests/teach-ariadne/teaching-session.test.ts`, `transfer-and-recovery.test.ts` |
| Teaching | Methodology Authoring teaches dependency-review guide, faded incident-handoff, metamethod transfer | 1 host × 1 skill | 3 (+6 in-process) | supported | `tests/teach-methodology/teaching-session.test.ts`, `transfer-and-recovery.test.ts` |
| Teaching | Harness Authoring teaches baseline-first continuation, issue triage, staged-self-application transfer | 1 host × 1 skill | 3 (+6 in-process) | supported | `tests/teach-harness/teaching-session.test.ts`, `transfer-and-recovery.test.ts` |
| Transfer | Held-out faded + changed-transfer tasks across session boundaries | 1 host × 3 skills × 2 task classes; tasks are deterministic fixtures run once in-process (not held-out pools, not repeated); process-boundary repetition demonstrated only for orchestration attempts | 3 | **inconclusive** | the three `transfer-and-recovery.test.ts` files; `tests/harness/effect-safety.test.ts` process seam |
| Adapter conformance | Matt + Ariadne adapters satisfy shared owner lifecycle contract (capabilities, wait/resume, cancel, cursors, invalid receipts, no copied owner state) | 2 adapters × 1 host | 3 | supported | both adapter lifecycle suites |
| Orchestration | Thin attempt continuity: one disposition after reset; durable dispatch intent; replay authorization; cancellation four-outcome discipline; ambiguity resolution authority | 1 host × 1 attempt engine × fault injections | 3 (+ child-process seam) | supported | `tests/harness/attempt.test.ts`, `tests/harness/effect-safety.test.ts` |
| Self-application | Fixed point N(F_A(M)) = N(M) = N(F_B(M)); immutable rounds; pin drift halt | 1 host × 2 assessors | 3 | supported | `tests/harness/self-application.test.ts` |
| Kernel necessity | No kernel retained; absence executable check holds; thinner baseline passed every critical criterion | 1 host | 6 (bounded) | supported | `tests/harness/no-kernel.test.ts`, `evidence/14-kernel-branch-disposition.md` |
| Lifecycle compatibility | Federated bundles: tuple pins, consumer wait gates, drain-under-pins, retirement gate, historical resolvability | 1 registry × 3 components × change cycle | 3 | supported | `tests/harness/release-bundle.test.ts` |
| Recovery | Fail-closed at every orchestration boundary; recovery tolerates only incomplete final record | 19 stable reasons defined; conflict/gap/expiry/drift/corruption cases exercised directly across three suites, remainder indirectly | 3 | supported | `tests/harness/attempt-fail-closed.test.ts`, `tests/harness/attempt.test.ts`, `tests/harness/effect-safety.test.ts` |

## Deletion-rule outcomes

Every layer compared against its matched thinner baseline with the same pinned tasks and sources:

| Layer | Thinner baseline | Result | Action |
| --- | --- | --- | --- |
| Orchestration Kernel | thin attempt module (skill-loader-plus-owner-artifacts) | baseline passed every critical criterion (#13, #14) | **deleted / never created**; absence check enforces |
| Thin attempt module | bare ad-hoc continuation (no ledger) | baseline fails durability/replay/cancellation invariants (#11–#13) | retained |
| Ariadne Harness Controller | direct capability use via provider manager | controller adds projection persistence used by CLI mode-D e2e | retained (thin; no kernel semantics) |
| Teaching Skills (×3) | unaided model loop without skill | baseline failed transfer/faded-task criteria in ticket #02/#04/#06/#08 verification rounds | retained |
| Release bundle registry | ad-hoc version bumps without receipts | baseline cannot express consumer wait/drain gates | retained |

No layer produced variable results; nothing is left inconclusive from a deletion comparison.

## Rung ceilings (unadvertised beyond this list)

- Rung 5 mutation evidence: **not achieved** anywhere yet → no validator-strength claims.
- Rung 6: bounded to the tested local Node process tree and same-volume filesystem; two-process seams only where cited above.
- Rung 8 production safety: **no claim made** — power-loss, distributed concurrency, multi-host matrices remain unadvertised.

## Independent review separation

Deterministic contract/artifact checks run first in every suite. Blinded semantic review by an independent human operator and an isolation audit independent of the suite that self-asserts workspace disposal have **not** been performed; reviewer passes recorded in ticket comments (#11–#16) are same-agent reviews, not blinded. Both remain open evidence work.

## Open evidence work (required before wider claims)

1. Rung 5 mutation runs (e.g. stryker-style MSI ≥ 85%) for validator suites.
2. Held-out transfer-task pools executed twice per advertised combination across real session/process boundaries for teaching skills.
3. Blinded semantic review plus an isolation audit independent from domain correctness.
4. Recording capabilities, pins, and dispositions fields on teaching-run reports alongside existing inputs/interventions/routes/artifacts/receipts/faults.

Until these land, the affected claims stay bounded as marked above and nothing wider is advertised.
