# 07 — Synchronize derived projections after merges

**What to build:** Rebuild generated graph projections from the merged canonical graph through one idempotent synchronization path, while non-blocking Git hooks keep valid divergent merges committable and protect host-owned metadata.

**Blocked by:** 02 — Preserve node divergence as Merge Contradictions; 06 — Install and diagnose Git merge integration safely.

**Status:** ready-for-agent

- [ ] Generated indexes and cards use a generated-file merge strategy that avoids textual conflicts and treats the canonical graph as their only semantic source.
- [ ] One idempotent synchronization command rebuilds indexes, cards, frontier, and open-unknown projections and is the documented repair path when hooks are absent or bypassed.
- [ ] `pre-merge-commit` runs post-merge validation, projection synchronization, and a concise non-blocking summary after an automatic merge.
- [ ] `pre-commit` applies the same path when ordinary Git conflicts were resolved manually before completing the merge.
- [ ] Hooks stage only fully derived indexes and cards; Ariadne-owned state projections change only in the working tree, remain unstaged, and report their path.
- [ ] Unrelated host-owned state fields survive synchronization byte-for-byte where ownership rules require it.
- [ ] A valid `DIVERGED` merge can still be committed locally, and hook output links to actual conflict cards without launching an agent, creating a queue item, or emitting handoff state.
- [ ] Setup remains idempotent and refuses to overwrite incompatible hook paths or hook files, reporting manual integration guidance instead.
