# Evidence Report — Effect Safety on the Thin Orchestration Path (Ticket 13)

**Candidate under test:** `src/harness/attempt.ts` — the thin skill-loader-plus-owner-artifacts Orchestration Attempt module (tickets 11–12), no dedicated kernel.

**Test artifact:** `tests/harness/effect-safety.test.ts` (fault-injected clean-session runs, one disposable workspace per injection) plus continuity suites `tests/harness/attempt.test.ts` and `tests/harness/attempt-fail-closed.test.ts`.

## Tested boundaries

| Boundary | What was exercised |
| --- | --- |
| Filesystem | Append-only JSONL ledgers in disposable `mkdtemp` workspaces; torn-tail and mid-history corruption; forged receipt rejection without payload storage |
| Process | Clean-session reconstruction via fresh disk-only loads; child-process boundary (`spawnSync` against the built module) for cold start, mid-run reset, and a reset immediately after the durable dispatch intent |
| Host | Permission callbacks (`hasHostPermission`) for approval revalidation; host-scheme cancellation receipts as the sole authority for cancellation outcomes |
| Adapter | Matt/Ariadne receipt scheme enforcement on direct-result joins; adapter capability strings against declared provider sets |
| Durability | Dispatch intent appended before effect execution; revision breaks from stale writers detected inside committed history |

## Invariant verdicts

Each invariant is reported independently. Verdict scale: supported / falsified / inconclusive.

**Rung achieved: Evidentiary Ladder Rung 3** (deterministic lifecycle-model behavior: schema, route, example, and lifecycle assertions in-process plus a real child-process seam). No claim is made at Rung 5/6.

### 1. Dispatch-intent durability and duplicate-dispatch prevention — SUPPORTED (Rung 3)

The dispatch intent is durable before any owner effect: `created → running` is appended to the ledger first; recovery after a reset (before or after an unknown-outcome effect) yields exactly one disposition, `inspect_effects`, and never re-`dispatch`es — including when a caller presents an up-to-date revision. Falsification attempts (re-dispatch with fresh revision) were injected and refused.

### 2. Replay authorization — SUPPORTED (Rung 3)

Replay starts from a zero counter and is granted only with an owner declaration carrying a specific operation string, the attempt's stable idempotency key, a finite unspent budget, a future deadline, and an owner inspection receipt resolving the prior effect (`prior_effect_unresolved` otherwise). Wrong key, empty operation, expired deadline each produce the stable `replay_declaration_invalid`; exhausting the budget produces `replay_budget_exhausted`.

### 3. Independent fault injections — SUPPORTED (Rung 3), scope-bounded

Stale concurrency, duplicate events, gapped events, corrupt state, cancellation races, false receipts, and ambiguity each received an independent disposable-workspace injection. All fail closed: stale-writer appends are detected as revision breaks in committed history (`ledger_corrupt`); conflicting duplicates, gaps, and regressions cannot advance the cursor; forged receipts never join nor store payloads; an approval grant racing a recorded cancellation intent resolves deterministically to acknowledgement of the intent. **Boundaries:** concurrency between two live writers is *detected after the fact* (single-writer ledger without CAS), not prevented by locking; the cancellation race is injected as a deterministic interleaving (intent present when the permission decision is taken), not as parallel threads.

### 4. Cancellation intent persistence — SUPPORTED (Rung 3)

Cancellation remains pure intent until an owner receipt distinguishes committed success (→ succeeded), acknowledged cancellation (→ canceled), no effect (→ canceled), or ambiguity (→ intent stays open). Resolving without recorded intent fails closed (`invalid_transition`).

### 5. Ambiguity resolution authority — SUPPORTED (Rung 3)

Only an owner receipt declaring `committed` or `no_effect` resolves ambiguity; declaring `ambiguous` is rejected. Compensation has no code path: it cannot be implied by resolution, and no disposition vocabulary contains a compensation action. It remains a separate owner-authorized operation by construction (absence).

### 6. No invented state on failure paths — SUPPORTED (Rung 3)

Failure dispositions carry only pointers derived from attempt state and stable reason profiles; none fabricate approvals, effect statuses, compensation, replay authority, or Epistemic State.

## Honest limits (no overstatement)

- **Rung ceiling:** per the spec's Testing Decisions, crash, concurrency, replay, cancellation, ambiguous-effect, and recovery safety require Rung 8 fault evidence before any production-safety claim. Every verdict above is Rung 3 and makes no production-safety claim.
- Replay declaration *issuance* is not cryptographically verified: `planReplay` validates the declared shape (specific operation, stable key, future deadline) and the attempt's resolved prior effect; proving who issued the declaration is beyond this rung.
- Single-process, single-host durability only: POSIX file appends without locking or cross-machine replication.
- Effects are simulated via receipts in disposable workspaces; per spec, no real ambiguous external effect was created or replayed.
- Approval-reset continuation was verified at session (disk-only reload) depth, not in a spawned child.
- No mutation testing (Rung 5) and no multi-environment clean-session matrix (Rung 6) were performed; verdicts do not extend beyond the tested boundaries above.
