# 02 — Preserve node divergence as Merge Contradictions

**What to build:** Let Git complete a lossless `DIVERGED` merge when branches disagree about a node, preserving the common-ancestor context and both materialized variants as a graph-native Merge Contradiction without choosing a branch.

**Blocked by:** 01 — Merge compatible Branch Epistemic Models through Git.

**Status:** ready-for-agent

- [ ] Different revisions of an existing node produce `DIVERGED` with exit code zero, keep the ancestor revision active, and preserve both complete variants in one unresolved `CTR-merge-*` node.
- [ ] Different add/add variants with the same new node ID remain inactive and recoverable inside the Merge Contradiction.
- [ ] Delete/unchanged and delete/delete apply one removal, while delete/modify keeps the ancestor active and preserves both operations as divergence.
- [ ] Conflict identity is derived from the subject, base, and sorted variant digests; branch order and repeated execution do not change it.
- [ ] An identical incident deduplicates, while changed variants create a new incident linked to the former incident with `supersedes`.
- [ ] Active and embedded variants preserve source provenance, and the contradiction records source digests and labels without copying raw branch event suffixes.
- [ ] Status, reports, and visualization show the unresolved contradiction, any shadowed ancestor value, conflict-card links, and reconciliation guidance through existing graph projections.
- [ ] A `branch_merge` contradiction remains visible as `MERGE_CONFLICT`, stays exempt from Separation Diversity, and is the only persisted state for a `DIVERGED` attempt.
