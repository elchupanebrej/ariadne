# 12 — Fail closed at orchestration boundaries

**What to build:** Give every unsafe or unavailable continuation boundary a deterministic waiting or failed disposition that identifies the missing authority or evidence and cannot accidentally dispatch another owner operation.

**Blocked by:** 11 — Continue a thin Orchestration Attempt after a clean-session reset.

**Status:** resolved

- [x] Approval, invalid artifact, pin mismatch, unsupported capability, expiry, corrupt state, and ambiguous effect each produce one stable reason and disposition.
- [x] Every waiting or failed disposition includes authority and evidence pointers, a Pending Action, a checkable resume predicate, and any relevant deadline.
- [x] A stale revision cannot dispatch, and an existing Dispatch Intent routes to inspection rather than another invocation.
- [x] Conflicting duplicates, cursor gaps or regressions, invalid transitions, and mismatched owners or pins fail closed.
- [x] Recovery accepts at most an incomplete final local record and rejects corruption in earlier committed history.
- [x] No failure path invents approval, effect status, compensation, replay authority, or Epistemic State.

## Comments

Extended the thin attempt module (`src/harness/attempt.ts`) with a stable `AttemptReason` vocabulary and a single `REASON_PROFILES` map: every waiting or failed disposition deterministically carries `authorityRef`, `evidenceRefs`, `pendingAction`, `resumePredicate`, and the attempt deadline; thrown boundaries expose the same shape via `BoundaryError.toDisposition()`. Dispatch now requires a proven-fresh request (`knownRevision` must equal `attempt.revision`; missing proof escalates `stale_revision`), capability support must be verifiable against a declared provider set, and requested pins must all be bound. The ledger became append-only JSONL: recovery drops at most an incomplete (unparseable or shape-invalid) final record, rejects parse corruption, wrong shape, id mismatch, or revision breaks anywhere in committed history, and distinguishes `attempt_missing` from `ledger_corrupt`. Lifecycle edges are validated by `transition()`; cursor conflicts/gaps/regressions stay fail-closed in `applyEvent`. Direct-result joins return enriched fail-closed outcomes for owner-mismatched receipts or invalid artifacts without storing payloads. 21 tests across both harness suites cover the six acceptance criteria.

Review-driven changes: stale-revision proof is mandatory for any dispatch disposition (not opt-in), unsupported-capability fails closed when no provider set is declared, recovered records are shape-validated (status enum plus required field types), and join failures carry full boundary profiles instead of bare reason codes.
