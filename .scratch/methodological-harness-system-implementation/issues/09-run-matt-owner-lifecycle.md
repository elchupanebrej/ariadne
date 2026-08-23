# 09 — Run a Matt skill through the owner lifecycle contract

**What to build:** Allow an Orchestration Attempt to invoke one pinned Matt skill through the shared lifecycle surface, wait and resume through owner pointers, observe normalized events, and import a direct result without intercepting Matt or local issue-tracker ownership.

**Blocked by:** 01 — Validate and resolve a pinned Method Contract.

**Status:** resolved

- [x] Capability negotiation declares supported skills, lifecycle operations, versions, and required artifact kinds before dispatch.
- [x] Start accepts a pinned skill and request reference and returns an external run reference rather than copied owner state.
- [x] Resume uses external run and input references; events use monotonic cursors with idempotent equal-cursor handling.
- [x] Cancellation remains a request until the Matt owner returns a terminal acknowledgment.
- [x] Invalid receipts, unsupported versions, cursor conflicts, and owner mismatches fail closed.
- [x] A direct Matt result can join an attempt through validated receipt and artifact pointers, while direct use remains available.

## Comments

- Implemented `MattOwnerAdapter` in `src/adapters/matt/lifecycle.ts` conforming to the shared lifecycle contract defined in `src/adapters/lifecycle.ts`.
- Verified all lifecycle operations (`capabilities`, `start`, `wait`, `resume`, `complete`, `cancel`, `acknowledgeCancellation`, `recordAmbiguousEffect`, `attachEffectInspectionReceipt`, `attemptAutoReplay`, `events`, `addPointer`, `importDirectResult`) with pointer-only references and no shadow state.
- Unit and contract tests verified in `tests/adapters/matt-lifecycle.test.ts` (12 tests passing).
