# 12 — Fail closed at orchestration boundaries

**What to build:** Give every unsafe or unavailable continuation boundary a deterministic waiting or failed disposition that identifies the missing authority or evidence and cannot accidentally dispatch another owner operation.

**Blocked by:** 11 — Continue a thin Orchestration Attempt after a clean-session reset.

**Status:** ready-for-agent

- [ ] Approval, invalid artifact, pin mismatch, unsupported capability, expiry, corrupt state, and ambiguous effect each produce one stable reason and disposition.
- [ ] Every waiting or failed disposition includes authority and evidence pointers, a Pending Action, a checkable resume predicate, and any relevant deadline.
- [ ] A stale revision cannot dispatch, and an existing Dispatch Intent routes to inspection rather than another invocation.
- [ ] Conflicting duplicates, cursor gaps or regressions, invalid transitions, and mismatched owners or pins fail closed.
- [ ] Recovery accepts at most an incomplete final local record and rejects corruption in earlier committed history.
- [ ] No failure path invents approval, effect status, compensation, replay authority, or Epistemic State.
