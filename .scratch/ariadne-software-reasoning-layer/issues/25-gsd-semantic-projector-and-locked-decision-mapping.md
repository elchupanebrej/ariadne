# 25 — GSD semantic projector and locked decision mapping

**What to build:** Projection layer that reads GSD requirements, roadmap, and phase context, mapping locked decisions (`D-*` in `CONTEXT.md`) directly to `DECIDED` provenance in the epistemic graph.

**Blocked by:** 24 — GSD detector and zero-shadow state enforcement

**Status:** resolved

- [ ] Reads requirements and phase context directly from GSD files into Ariadne graph representation
- [ ] Assigns immutable `DECIDED` provenance to locked GSD decisions
- [ ] Rejects attempts by agents to reopen settled human decisions without invalidating evidence

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: adapters/gsd/projector.ts projectGsd D-* -> LOCKED DEC nodes; assertDecisionReopenAllowed requires human instruction or falsifying evidence; gsd tests. Full suite green (53 files / 557+ tests), typecheck clean.
