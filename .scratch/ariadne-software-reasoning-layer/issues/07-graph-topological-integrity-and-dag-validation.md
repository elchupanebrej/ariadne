# 07 — Graph topological integrity and DAG validation

**What to build:** Graph integrity validator ensuring that deductive premise edges (`derived_from`, `depends_on`) form a strict Directed Acyclic Graph (DAG) and that all edge references point to existing nodes.

**Blocked by:** 05 — Atomic file storage manager

**Status:** ready-for-agent

- [ ] Cycle detection algorithm catches circular dependencies in deductive chains
- [ ] Referential integrity checks verify that source and target nodes exist in the graph
- [ ] Clear diagnostic errors pinpoint cyclic paths and broken references
