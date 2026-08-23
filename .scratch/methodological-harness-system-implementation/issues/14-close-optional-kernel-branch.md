# 14 — Close the optional Orchestration Kernel branch

**What to build:** Apply the matched thin-path evidence non-compensatorily: retain no kernel when the thin path satisfies every hard continuation invariant, or implement the smallest co-located owner-neutral kernel that repairs the specifically falsified invariants and rerun the same evidence cases.

**Blocked by:** 08 — Verify Harness Authoring transfer and deletion discipline; 13 — Measure effect safety on the thin path.

**Status:** resolved

- [x] The disposition lists every hard invariant, its thin-path evidence, and its supported, falsified, or inconclusive verdict without weighted averaging.
- [x] If the thin path passes, no kernel code or state remains and an executable deletion or absence check protects that result.
- [x] If retention is justified, one co-located internal TypeScript module owns only pointer-based attempt lifecycle state and remains separate from Ariadne's controller and Epistemic Overlay.
- [x] A retained kernel uses one append ledger per attempt, serializes only that attempt, validates expected revision, and persists Dispatch Intent before invocation.
- [x] Recovery accepts at most an incomplete final record, preserves immutable history, and routes existing intent to owner inspection.
- [x] The retained path passes the exact matched cases that falsified every eligible thinner candidate.
- [x] Claims stay bounded to the tested local process and same-volume filesystem; power-loss and distributed-concurrency safety remain unclaimed.
- [x] No new package, service, database, queue, scheduler, IPC protocol, global lock, migration framework, rollback engine, compensation engine, or alert router is introduced without separate evidence.

## Comments

Applied the non-compensatory rule to ticket 13's evidence: all ten hard continuation invariants are supported at Rung 3 with no falsified or inconclusive row, so the retention branch is not triggered — **no kernel was retained**. Disposition record: `evidence/14-kernel-branch-disposition.md` (invariant-by-invariant table mapped to ticket 13's measured invariants and the ticket 11/12 suites, N/A rationale for retention-only items, bounded claims, zero new infrastructure). The result is protected by `tests/harness/no-kernel.test.ts`: `src/harness/` stays exactly {attempt.ts, controller.ts}; no exported kernel symbol exists anywhere under `src/` (full recursive walk including dotted directories); the attempt module's import surface is pinned to a fixed allowlist (fs/path builtins + shared pointer validation) so no facility dependency can enter; runtime dependencies stay `{zod}` by key-set; and separation from controller/graph/gates/core holds in both directions. Checklist items 3–6 are recorded as not-applicable-as-kernel-requirements: nothing was retained, and the thin path already exhibits the listed ledger/intent properties as ordinary artifacts verified by rows 1–10.

Review-driven changes: fixed a directory-walk hole that skipped dotted directories, replaced the hardcoded zod version pin with key-set equality, widened the separation check to imports from subsystems back into the attempt module (not just the forward direction), added the explicit ticket-13 invariant mapping, collapsed two overlapping guard strategies into one exact import allowlist, and named the textual-scan ceiling inline.
