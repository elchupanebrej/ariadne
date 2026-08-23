# 33 — Normative acceptance scenarios A–J conformance suite

**What to build:** Comprehensive conformance test suite implementing all 10 normative acceptance scenarios (Scenarios A through J) from Spec v5 Section 18.

**Blocked by:** 29 — Git worktree isolation for Deep Mode, 30 — Subagent delta envelope parser and merger (ariadne-delta), 31 — Standalone Mode D E2E test suite and context recovery, 32 — Ecosystem modes A, B, C integration test suite

**Status:** resolved

- [ ] Scenarios A through J automated with end-to-end assertions
- [ ] 100% of acceptance scenarios pass with 0 failures or unhandled exceptions
- [ ] Verification output confirms complete specification conformance

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: tests/e2e/acceptance-scenarios.test.ts scenarios A-J asserting normative behaviors; green this run. Full suite green (53 files / 557+ tests), typecheck clean.
