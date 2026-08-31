# 04 — Detect Decision Scope divergence without changing authority

**What to build:** Detect incompatible branch decisions that settle the same Decision Scope, even when their node IDs differ, without promoting provenance or granting either branch merged-scope authority.

**Blocked by:** 02 — Preserve node divergence as Merge Contradictions.

**Status:** resolved

- [x] Decision nodes may declare an optional stable Decision Scope without forcing existing decisions or ordinary nodes through a migration.
- [x] Incompatible decisions with the same Decision Scope produce one decision-scope Merge Contradiction and neither branch decision becomes globally authoritative.
- [x] A decision already locked in the common ancestor remains historically locked while the merged-scope decision gate reports unresolved divergence.
- [x] Merge never synthesizes decision authorization, reopens a locked decision, or changes the provenance of active or embedded claims.
- [x] Ordinary nodes continue to match only by node ID; different-ID non-decision claims remain independently active even when their prose appears contradictory.
- [x] Swapped branch roles produce the same decision conflict identity, active graph, and normalized Merge Receipt.
