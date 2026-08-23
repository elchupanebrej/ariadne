# 26 — GSD operational notice signaling (NOT-*)

**What to build:** Non-invasive signaling subsystem that logs `OperationalNotice` records (`NOT-*`) to `.planning/ariadne/NOTICES.jsonl` and updates `STATE.yaml` when an assumption is falsified, preserving GSD historical phase files.

**Blocked by:** 09 — Transitive invalidation cascade engine, 25 — GSD semantic projector and locked decision mapping

**Status:** resolved

- [ ] Appends structured `NOT-*` notice to `NOTICES.jsonl` upon assumption invalidation
- [ ] Renders non-invasive alert banner to stdout without modifying GSD `SUMMARY.md` history
- [ ] Registers active notice IDs in `.planning/ariadne/STATE.yaml`

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: adapters/gsd/operational-notice.ts NOT-* NOTICES.jsonl + stdout banner + active_notices state registration; gsd-notice tests + scenario E. Full suite green (53 files / 557+ tests), typecheck clean.
