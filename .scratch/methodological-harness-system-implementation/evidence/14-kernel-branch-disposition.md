# Kernel Branch Disposition — Ticket 14

> Addendum (ticket 15): this file is now a pinned bootstrap input. Ticket 15's
> round runner digests its bytes and the ticket-15 diff widened the thin-path
> module list to include the self-application runner; no kernel component was
> introduced by that amendment.

**Rule applied (non-compensatory):** retain no Orchestration Kernel if the thin path supports every hard continuation invariant; implement the smallest co-located kernel only for specifically falsified invariants. Verdicts are never averaged: one falsified invariant would force the retention branch.

## Disposition table

| # | Hard continuation invariant | Evidence | Verdict |
| --- | --- | --- | --- |
| 1 | Exactly one valid next disposition reconstructed from repository-visible state after a clean-session reset (cold start, mid-run reset) | `tests/harness/attempt.test.ts` — "cold start reconstructs…", "mid-run reset falls back to owner effect inspection"; child-process seam in the same suite | supported |
| 2 | Dispatch Intent persisted before invocation; duplicate dispatch prevented across resets (session and real process boundary immediately after intent) | `tests/harness/effect-safety.test.ts` — "keeps the dispatch intent durable…", "survives a real process reset…" | supported |
| 3 | Replay only with owner declaration: specific operation, stable key matching the attempt's idempotency key, future deadline, finite zero-start budget, resolved prior effect | `tests/harness/effect-safety.test.ts` — "grants replay only against a complete owner declaration…" | supported |
| 4 | Cancellation stays intent until an owner receipt distinguishes committed success / acknowledged / no effect / ambiguous | `tests/harness/effect-safety.test.ts` — "keeps cancellation as intent until an owner receipt…" | supported |
| 5 | Ambiguity resolves only via a committed or no-effect Owner Effect Receipt; compensation has no code path | `tests/harness/effect-safety.test.ts` — "lets only committed or no-effect owner receipts resolve ambiguity" | supported |
| 6 | Event cursor idempotence; conflicts, gaps, regressions fail closed | `tests/harness/attempt.test.ts` — "treats equal cursor and digest as idempotent…"; `tests/harness/attempt-fail-closed.test.ts` — cursor cases | supported |
| 7 | Recovery tolerates at most an incomplete final record; rejects corruption, wrong shape, or revision breaks in committed history | `tests/harness/attempt-fail-closed.test.ts` — recovery and missing-vs-corrupt tests | supported |
| 8 | Every unsafe boundary yields one stable reason plus authority, evidence, pending action, resume predicate, deadline | `tests/harness/attempt-fail-closed.test.ts` — stable-reason, enrichment, join-outcome tests | supported |
| 9 | Stale revision cannot dispatch; existing Dispatch Intent routes to inspection, never re-invocation | `tests/harness/attempt-fail-closed.test.ts` — stale/intent test; effect-safety durability test | supported |
| 10 | Mismatched owners or pins fail closed without payload copying | `tests/harness/effect-safety.test.ts` — false-receipt test; `attempt-fail-closed.test.ts` — pin_mismatch case, join outcome | supported |

## Decision

**No kernel is retained.** The thin skill-loader-plus-owner-artifacts path (`src/harness/attempt.ts`) supports every hard invariant above; no invariant was falsified or left inconclusive, so the retention branch is not triggered. Rows 1, 2, 4, and 5 correspond to ticket 13's measured invariants 1 (dispatch-intent durability), 3 (replay authorization), 4 (cancellation intent persistence), and 5 (ambiguity resolution authority); rows 6–10 extend the same non-compensatory treatment to the continuation invariants established by tickets 11 and 12.

The result is protected by an executable absence check, `tests/harness/no-kernel.test.ts`, which asserts:

- `src/harness/` contains only thin-path modules — the attempt module, the pre-existing controller, and (added by ticket 15) the immutable staged-self-application round runner; no kernel component;
- no exported kernel symbol exists anywhere under `src/`;
- the attempt module's import surface is pinned to a fixed allowlist (Node file/path builtins plus the shared pointer-validation helpers) — no network, IPC, worker, lock, queue, database, scheduler, or migration facilities can enter;
- runtime dependencies remain `{ zod }` (key-set check; version bumps are not infrastructure);
- the attempt module stays separate from Ariadne's controller, graph storage, gates, and Epistemic Overlay: it imports none of them, and none of them import it back.

Checklist items that presuppose retention ("one co-located internal TypeScript module owns only pointer-based attempt lifecycle state", "one append ledger per attempt… persists Dispatch Intent before invocation") are **not applicable as kernel requirements**: nothing was retained. For the record, the thin path already exhibits those properties as ordinary thin-path artifacts — append-only JSONL ledger per attempt, single-attempt serialization, revision validation, intent-before-invocation — verified by the evidence rows above rather than by a retained component. The matched falsification rerun (item 6 of the checklist) is likewise vacuous: there are no falsified candidates to repair and no kernel whose absence must be re-tested beyond the standing absence check.

## Bounded claims

All verdicts are bounded to the tested local process tree and same-volume filesystem at Evidentiary Ladder Rung 3 (see ticket 13's report for the rung ceiling and fault-injection scope). Power-loss durability, distributed concurrency, and production safety remain unclaimed; per the spec's Testing Decisions they require higher-rung evidence before any such claim.

## Introduced infrastructure

None. No package, service, database, queue, scheduler, IPC protocol, global lock, migration framework, rollback engine, compensation engine, or alert router was added; the absence check enforces this continuously.
