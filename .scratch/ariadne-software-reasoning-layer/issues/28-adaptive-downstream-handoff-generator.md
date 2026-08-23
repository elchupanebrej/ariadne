# 28 — Adaptive downstream handoff generator

**What to build:** Handoff generator creating structured `HANDOFF.md` containing verified facts, active invariants, and ADR links, recommending `/to-spec` or `/to-tickets` without auto-invoking human-only skills.

**Blocked by:** 25 — GSD semantic projector and locked decision mapping, 27 — Matt skills output ingestion and normalization

**Status:** resolved

- [ ] `generateHandoff(decId)` produces complete, concise handoff artifact
- [ ] Includes verified facts, active invariants, and next recommended user command
- [ ] Strictly enforces boundary against auto-invoking human-only delivery skills

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: adapters/handoff/generator.ts generateHandoff HANDOFF.md with verified facts/invariants/ADR refs; recommends only /to-spec or /to-tickets; refuses stale basis; handoff tests + scenario D. Full suite green (53 files / 557+ tests), typecheck clean.
