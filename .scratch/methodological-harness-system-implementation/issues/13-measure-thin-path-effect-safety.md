# 13 — Measure effect safety on the thin path

**What to build:** Run the thin Orchestration Harness candidate through matched fault-injected Clean-Session Runs and produce bounded evidence showing whether it can preserve dispatch, replay, cancellation, concurrency, and ambiguous-effect invariants without a dedicated kernel.

**Blocked by:** 12 — Fail closed at orchestration boundaries.

**Status:** ready-for-agent

- [ ] Process resets immediately before and after an owner effect test durable Dispatch Intent and duplicate-dispatch prevention.
- [ ] Replay starts at zero and is attempted only with an owner-issued operation-specific declaration, stable key, finite budget, deadline, and resolved prior effect.
- [ ] Stale concurrency, duplicate and gapped events, corrupt state, cancellation races, false receipts, and ambiguity each receive an independent disposable-workspace fault injection.
- [ ] Cancellation remains intent until an owner receipt distinguishes committed success, acknowledged cancellation, no effect, or ambiguity.
- [ ] Only an Owner Effect Receipt declaring committed or no-effect resolves ambiguity; compensation remains a separate owner-authorized operation.
- [ ] Each invariant is reported independently as supported, falsified, or inconclusive at the achieved Evidentiary Ladder rung.
- [ ] The report records tested filesystem, process, host, adapter, and durability boundaries without implementing a kernel or overstating safety.
