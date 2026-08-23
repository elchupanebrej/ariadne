# 13 — Measure effect safety on the thin path

**What to build:** Run the thin Orchestration Harness candidate through matched fault-injected Clean-Session Runs and produce bounded evidence showing whether it can preserve dispatch, replay, cancellation, concurrency, and ambiguous-effect invariants without a dedicated kernel.

**Blocked by:** 12 — Fail closed at orchestration boundaries.

**Status:** resolved

- [x] Process resets immediately before and after an owner effect test durable Dispatch Intent and duplicate-dispatch prevention.
- [x] Replay starts at zero and is attempted only with an owner-issued operation-specific declaration, stable key, finite budget, deadline, and resolved prior effect.
- [x] Stale concurrency, duplicate and gapped events, corrupt state, cancellation races, false receipts, and ambiguity each receive an independent disposable-workspace fault injection.
- [x] Cancellation remains intent until an owner receipt distinguishes committed success, acknowledged cancellation, no effect, or ambiguity.
- [x] Only an Owner Effect Receipt declaring committed or no-effect resolves ambiguity; compensation remains a separate owner-authorized operation.
- [x] Each invariant is reported independently as supported, falsified, or inconclusive at the achieved Evidentiary Ladder rung.
- [x] The report records tested filesystem, process, host, adapter, and durability boundaries without implementing a kernel or overstating safety.

## Comments

Ran the thin candidate (`src/harness/attempt.ts`) through fault-injected clean-session runs in `tests/harness/effect-safety.test.ts` (10 tests, one disposable workspace per injection) and produced the bounded evidence report at `evidence/13-thin-path-effect-safety-report.md`. New module surface: `planReplay` (owner declaration with specific operation, stable key matching the attempt's idempotency key, future deadline via injectable clock, finite zero-start budget, and a joined owner inspection receipt), `resolveEffects` (only committed/no-effect owner receipts resolve ambiguity; compensation has no code path by construction), and `resolveCancellation` (intent persists until a host/owner receipt distinguishes committed success / acknowledged / no effect / ambiguous). Dispatch-intent durability is proven across both disk-only session reloads and a real spawned child process immediately after the intent; stale-writer appends are exposed as revision breaks by the next legitimate write; an approval grant racing a recorded cancellation intent resolves deterministically to acknowledgement. All six invariants reported SUPPORTED at Evidentiary Ladder Rung 3 with declared verdict scale and honest limits (single-writer ledger detects concurrency after the fact; simulated effects only).

Review-driven changes: added the missing process-seam probe around the owner effect and a deterministic cancellation-race injection; report now states the spec's Rung-8 production-safety ceiling and that declaration *issuance* is not cryptographically verified at this rung; deduplicated the budget gate (`budgetExhausted`) and outcome shape (`GuardOutcome`); made replay deadlines injectable-clock-testable; removed caller-supplied key text from disposition evidence.
