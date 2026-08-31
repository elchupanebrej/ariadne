# 03 — Quarantine edge and topology divergence

**What to build:** Preserve branch-local edge and topology changes that cannot coexist inside Merge Contradictions, while Causal Quarantine keeps the active Epistemic Graph referentially valid and acyclic.

**Blocked by:** 02 — Preserve node divergence as Merge Contradictions.

**Status:** ready-for-agent

- [ ] Opposed edge addition and removal uses normal three-way semantics, preserving the base edge state when one exists and otherwise leaving the edge inactive.
- [ ] Independently valid branch changes whose union creates a dangling reference, invalid endpoint relation, or deductive cycle return `DIVERGED` rather than `FAILED`.
- [ ] Each connected topology violation becomes a deterministic Merge Contradiction containing every quarantined materialized node and edge state needed to recover the branch-local knowledge.
- [ ] Causal Quarantine follows the existing invalidation influence orientation transitively but withholds only values added or changed by a branch.
- [ ] Non-causal relations such as references, contradictions, tests, and falsification do not expand Causal Quarantine, so unrelated nodes remain active.
- [ ] The active merged graph passes schema, referential-integrity, endpoint-relation, and deductive-DAG validation.
- [ ] Quarantine at its hard ceiling succeeds; exceeding the ceiling returns `FAILED` without changing output or emitting a truncated contradiction.
