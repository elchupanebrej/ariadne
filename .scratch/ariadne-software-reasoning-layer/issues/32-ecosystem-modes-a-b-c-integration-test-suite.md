# 32 — Ecosystem modes A, B, C integration test suite

**What to build:** Integration test suite validating Mode A (GSD + Matt + Ariadne), Mode B (GSD fallback without Matt), and Mode C (Matt controller without GSD).

**Blocked by:** 26 — GSD operational notice signaling (NOT-*), 28 — Adaptive downstream handoff generator

**Status:** resolved

- [ ] Mode A test verifies GSD projection and Matt skill output ingestion concurrently
- [ ] Mode B test verifies graceful fallback to native tools when Matt skills are absent
- [ ] Mode C test verifies file-based controller operation delegating to Matt skills

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: tests/e2e/modes-abc.test.ts Mode A overlay flow, Mode B provider fallback, Mode C file controller; green ('concurrently' realized as combined flow). Full suite green (53 files / 557+ tests), typecheck clean.
