# 24 — GSD detector and zero-shadow state enforcement

**What to build:** Environment detector for GSD workspaces (`.planning/`) with an invariant checker asserting that Ariadne creates no duplicate `PROJECT.md`, `ROADMAP.md`, `REQUIREMENTS.md`, or `STATE.md` files.

**Blocked by:** 05 — Atomic file storage manager, 10 — Structural quality gate

**Status:** resolved

- [ ] Detector accurately identifies active GSD installation and `.planning/` directory
- [ ] Zero-shadow assertion raises an error if duplicate project-management files are created in GSD mode
- [ ] Ariadne redirects state storage cleanly to `.planning/ariadne/` overlay

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: adapters/gsd/detector.ts detectGsd + assertNoShadowState + .planning/ariadne overlay; adapters/gsd.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
