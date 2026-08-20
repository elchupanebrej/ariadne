# 31 — Standalone Mode D E2E test suite and context recovery

**What to build:** Automated end-to-end integration test verifying that standalone Ariadne initializes `.ariadne/`, executes reasoning operations, and recovers complete epistemic state across simulated context resets.

**Blocked by:** 16 — CLI invalidation command (ariadne invalidate), 17 — CLI quality gate commands (ariadne gate), 18 — CLI init and template scaffolding (ariadne init / template), 23 — Rules for dependencies, dynamics, value, validate operations (60, 70, 80, 90)

**Status:** ready-for-agent

- [ ] Tests full lifecycle from `ariadne init` through node additions, edge connections, and invalidations
- [ ] Simulates context reset by wiping process memory and verifying state restoration from `.ariadne/`
- [ ] All standalone test assertions pass deterministically
