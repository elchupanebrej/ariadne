# 32 — Ecosystem modes A, B, C integration test suite

**What to build:** Integration test suite validating Mode A (GSD + Matt + Ariadne), Mode B (GSD fallback without Matt), and Mode C (Matt controller without GSD).

**Blocked by:** 26 — GSD operational notice signaling (NOT-*), 28 — Adaptive downstream handoff generator

**Status:** ready-for-agent

- [ ] Mode A test verifies GSD projection and Matt skill output ingestion concurrently
- [ ] Mode B test verifies graceful fallback to native tools when Matt skills are absent
- [ ] Mode C test verifies file-based controller operation delegating to Matt skills
