# 03 — Provenance lattice algebra and directed edges

**What to build:** Formal provenance ordering (U ⊏ A ⊏ P ⊏ D ⊏ M ⊏ F ⊏ L), meet-operator comparator, and directed edge validation preventing invalid relationships and cycles.

**Blocked by:** 02 — Zod schemas for canonical epistemic nodes

**Status:** ready-for-agent

- [ ] Provenance lattice ordering implements U ⊏ A ⊏ P ⊏ D ⊏ M ⊏ F ⊏ L strictly
- [ ] `isMoreRigorous(p1, p2)` and meet operator `meetProvenance([p1, p2, ...])` implemented and tested
- [ ] Edge schema defines valid source/target pairs for `supports`, `contradicts`, `depends_on`, `derived_from`, `falsifies`, `invalidates`, `satisfies`, `violates`, `references`
