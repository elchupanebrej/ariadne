# 05 — Terminal status integration across projections and verification gates

**What to build:**
End-to-end terminal treatment for `WAIVED` and `SUPERSEDED` nodes across all Ariadne projections and verification gates. Projections (the zero-JS HTML visualization in `ariadne viz`, decision tree and epistemic forest reports in `ariadne report`, card files, and status views) treat `WAIVED` and `SUPERSEDED` as terminal states rather than active frontier work, and display their closure references (`waived by <DEC>` or `superseded by <DEC>`). Verification gates (`EpistemicGateEngine`, semantic gate, epistemic gate) recognize both statuses as terminal and non-blocking. Pre-existing legacy unknowns marked `RESOLVED` with `resolved_by` coexist without migration or validation errors.

**Blocked by:** 01 — Unknown waiver lifecycle and CLI (`ariadne waive <UNK> --by <DEC>`), 02 — Decision supersession lifecycle and CLI (`ariadne supersede <DEC> --by <DEC>`)

**Status:** resolved

- [x] `ariadne viz` recognizes `WAIVED` and `SUPERSEDED` as terminal node statuses and renders them properly styled as closed/terminal rather than active work.
- [x] `ariadne report` renders closing references in decision tree and forest outputs (e.g., displaying `waived by <DEC>` and `superseded by <DEC>`).
- [x] `ariadne status` and frame continuation classifiers treat `WAIVED` unknowns and `SUPERSEDED` decisions as terminal, avoiding false `insufficient-information` or `blocked-dependency` continuation suggestions.
- [x] `EpistemicGateEngine` verification passes when dependencies have `WAIVED` or `SUPERSEDED` status where terminal status is expected.
- [x] Legacy graphs containing hand-marked `status: RESOLVED` unknowns with `resolved_by` attributes continue to parse, pass gates, and render as closed without schema migration.
- [x] Card files for waived unknowns and superseded decisions display their closing references.
- [x] Behavior is verified with integration tests across viz, report, status, and gate outputs.
