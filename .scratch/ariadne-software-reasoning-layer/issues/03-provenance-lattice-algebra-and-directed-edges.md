# 03 — Provenance lattice algebra and directed edges

**What to build:** Formal provenance ordering (U ⊏ A ⊏ P ⊏ D ⊏ M ⊏ F ⊏ L), meet-operator comparator, and directed edge validation preventing invalid relationships and cycles.

**Blocked by:** 02 — Zod schemas for canonical epistemic nodes

**Status:** resolved

- [ ] Provenance lattice ordering implements U ⊏ A ⊏ P ⊏ D ⊏ M ⊏ F ⊏ L strictly
- [ ] `isMoreRigorous(p1, p2)` and meet operator `meetProvenance([p1, p2, ...])` implemented and tested
- [ ] Edge schema defines valid source/target pairs for `supports`, `contradicts`, `depends_on`, `derived_from`, `falsifies`, `invalidates`, `satisfies`, `violates`, `references`

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: PROVENANCE_RANK + isMoreRigorous/meetProvenance in core/types/provenance.ts; EDGE_ENDPOINT_CONTRACTS in schemas/edges.ts; provenance tests. Full suite green (53 files / 557+ tests), typecheck clean.
