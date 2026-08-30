# 0013. HTML Decision Tree Projection via `ariadne viz`

## Context and Decision
The Decision Tree Report (`ariadne report`) renders the epistemic graph as an ASCII tree. Humans reviewing decisions need a visual reading, and the skill must be able to produce it on request.

We decided on:
1. **Separate `ariadne viz [FRAME-id]` command** rather than a `--html` flag on `report`: the text report stays canonical for in-response embedding; the visualization is a distinct entry point with its own usage line. Both share the ordinal file sequence under `<storage root>/reports/` (one artifact, two projections).
2. **Self-contained zero-JavaScript HTML**: a single file with inline CSS and native `<details>` for collapsing subtrees and card expansion. No CDN, no dependencies, works offline and as a shareable artifact. The graph is a DAG, so a static tree render is deterministic and bounded.
3. **Shared traversal logic**: `fold`, `childEdges`, `reachableCount`, and forest/remainder computation were extracted to `src/graph/traversal.ts` and are imported by both renderers, so graph-walk semantics cannot drift between projections.
4. **Content contract mirrors the text report**: FRAME-rooted forest sections, edge-type labels on branches, the same change-log filter (CAN/DEC/EVD/UNK appends + tombstones), plus a frontier header (open unknowns, candidate count) and provenance/type coloring (7-lattice provenance chips, type-group hues, struck-through tombstones). Card labels link to the persisted card files.
   Each rendered node also has a `?` link to the relevant diagram in the methodology book.
5. **Skill wiring**: `rules/05-uncertainty.md` and `SKILL.md` mention `ariadne viz` as the HTML projection to invoke when a visual rendering is requested.

## Consequences and Trade-offs
- Humans get a browsable dark-themed decision tree with provenance semantics at a glance; agents still embed the text tree in responses.
- Zero-JS static HTML means no interactive pan/zoom or search; native `<details>` covers collapse/expand and browser Ctrl+F covers filtering.
- The shared traversal module changes the text report too: any regression in fold/forest semantics would surface in both projections (covered by existing `report.test.ts` plus new `viz.test.ts`).
