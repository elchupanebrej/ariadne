# 28 — Adaptive downstream handoff generator

**What to build:** Handoff generator creating structured `HANDOFF.md` containing verified facts, active invariants, and ADR links, recommending `/to-spec` or `/to-tickets` without auto-invoking human-only skills.

**Blocked by:** 25 — GSD semantic projector and locked decision mapping, 27 — Matt skills output ingestion and normalization

**Status:** ready-for-agent

- [ ] `generateHandoff(decId)` produces complete, concise handoff artifact
- [ ] Includes verified facts, active invariants, and next recommended user command
- [ ] Strictly enforces boundary against auto-invoking human-only delivery skills
