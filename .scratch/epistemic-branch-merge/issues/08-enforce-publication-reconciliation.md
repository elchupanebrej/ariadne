# 08 — Enforce reconciliation only at the publication boundary

**What to build:** Give CI and protected-branch policy a separate read-only command that rejects unresolved Merge Contradictions without changing the semantic merge result or preventing local integration.

**Blocked by:** 02 — Preserve node divergence as Merge Contradictions.

**Status:** ready-for-agent

- [ ] The explicit merge check returns non-zero and lists conflict-card links when unresolved `branch_merge` contradictions exist.
- [ ] The check returns zero after every relevant contradiction is resolved and does not confuse unrelated contradiction types with merge policy.
- [ ] Running the check never appends graph events, changes projections, edits Git configuration, launches an agent, or creates an Operational Notice.
- [ ] An integration fixture proves that the same valid `DIVERGED` graph can be merged and committed locally while the publication check fails.
- [ ] Structural and epistemic validation remain active independently, while Separation Diversity stays exempt for unresolved `branch_merge` contradictions.
- [ ] Structured output is stable enough for CI consumption without parsing human-readable prose.
