# 11 — Continue a thin Orchestration Attempt after a clean-session reset

**What to build:** Let a fresh process or session reconstruct exactly one valid next action for a pinned pointer-only Orchestration Attempt using the thin skill-loader-plus-owner-artifacts path, including an approval wait and later resumption.

**Blocked by:** 09 — Run a Matt skill through the owner lifecycle contract; 10 — Run Ariadne through the shared owner lifecycle contract.

**Status:** ready-for-agent

- [ ] The attempt retains only its identifier, opaque step, lifecycle status, revision, counter, pins, idempotency key and deadline, replay budget, cursor, cancellation intent, and owner pointers.
- [ ] A clean-session reset reconstructs one and only one valid next disposition from declared repository-visible state.
- [ ] Approval waiting resumes only from a bound, unexpired owner approval pointer after host permission is revalidated.
- [ ] Equal event cursors and digests are idempotent; cursor conflicts or gaps cannot advance the attempt.
- [ ] Direct Matt and Ariadne results join through pinned owner receipts without interception or payload copying.
- [ ] Cold start, mid-run reset, and approval reset are verified across a real process or session boundary.
