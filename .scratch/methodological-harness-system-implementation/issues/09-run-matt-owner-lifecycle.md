# 09 — Run a Matt skill through the owner lifecycle contract

**What to build:** Allow an Orchestration Attempt to invoke one pinned Matt skill through the shared lifecycle surface, wait and resume through owner pointers, observe normalized events, and import a direct result without intercepting Matt or local issue-tracker ownership.

**Blocked by:** 01 — Validate and resolve a pinned Method Contract.

**Status:** ready-for-agent

- [ ] Capability negotiation declares supported skills, lifecycle operations, versions, and required artifact kinds before dispatch.
- [ ] Start accepts a pinned skill and request reference and returns an external run reference rather than copied owner state.
- [ ] Resume uses external run and input references; events use monotonic cursors with idempotent equal-cursor handling.
- [ ] Cancellation remains a request until the Matt owner returns a terminal acknowledgment.
- [ ] Invalid receipts, unsupported versions, cursor conflicts, and owner mismatches fail closed.
- [ ] A direct Matt result can join an attempt through validated receipt and artifact pointers, while direct use remains available.
