# 06 — Compact index markdown generator (INDEX.md)

**What to build:** Automatic generator rendering `.ariadne/INDEX.md` summarizing the epistemic frontier, active claims, unresolved unknowns, and candidate mechanisms in a token-efficient format for agent consumption.

**Blocked by:** 05 — Atomic file storage manager

**Status:** resolved

- [ ] `INDEX.md` renders concise summary tables of current problem state and active unknowns
- [ ] Index generation runs automatically on any graph mutation
- [ ] Output stays compact (< 500 tokens for standard graphs)

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: renderIndex frontier/unknowns/candidates tables auto-written on every mutation; <500-word assertions in index-generator tests. Full suite green (53 files / 557+ tests), typecheck clean.
