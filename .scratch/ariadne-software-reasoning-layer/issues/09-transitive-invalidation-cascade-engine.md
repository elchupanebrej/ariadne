# 09 — Transitive invalidation cascade engine

**What to build:** Transitive reachability engine that propagates invalidation across downstream dependencies when an assumption (`ASM-`) or hypothesis (`HYP-`) is falsified by an evidence result (`EVD-`).

**Blocked by:** 07 — Graph topological integrity and DAG validation, 08 — Weakest-precondition derivation engine

**Status:** ready-for-agent

- [ ] Falsification of a node triggers reverse topological traversal along `depends_on`, `derived_from`, and `supports` edges
- [ ] Downstream candidate mechanisms and decisions are marked as `NEEDS_REVIEW` / `INVALIDATED`
- [ ] Historical records are preserved with invalidation metadata without deleting nodes
