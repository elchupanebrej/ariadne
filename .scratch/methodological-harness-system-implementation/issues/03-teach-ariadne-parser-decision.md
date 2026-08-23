# 03 — Teach Ariadne through a complete parser decision

**What to build:** Let a fresh session learn Ariadne by completing the config-line parser decision from declared pinned inputs, progressively loading only the Reasoning Operations needed for the current branch and producing an isolated, evidence-backed decision that can be explained after its runnable check passes.

**Blocked by:** 01 — Validate and resolve a pinned Method Contract.

**Status:** resolved

- [x] A Clean-Session Run starts with the parser task and records every declared input in an auditable manifest.
- [x] The lesson loads the router, uncertainty rule, selected operation rules, graph mutation contract, and relevant evidence rule only when triggered.
- [x] A proposed package remains a Candidate Mechanism, and three structurally distinct candidates are hard-filtered before selection.
- [x] Executable parser checks emit the matched Evidence Result before the decision is locked.
- [x] Lesson mutations are isolated from the live Epistemic Overlay and invalid lesson artifacts are rejected.
- [x] Self-explanation occurs only after the runnable check passes and cites live Ariadne and Method Contract sources.

## Comments

- Built Ariadne Teaching Skill at `.agents/skills/teach-ariadne/` and engine in `src/teach-ariadne/`.
- Implemented task-first progressive loader with declared input manifest, prohibiting bulk preloading or copied Method Contract prose.
- Implemented 3-candidate exploration and hard requirement filtering (rejecting JSON representation change and environment boundary delegation).
- Implemented runnable parser checks in `example/check.mjs` (covering 4 deterministic cases) emitting Rung 3 `EVD-config-line-parser-r3` before locking `DEC-config-line-parser`.
- Isolated example graph under `example/.ariadne/` with valid schema/epistemic nodes.
- Enforced self-explanation gating (only runnable check completion unlocks 4 why-question validations), followed by faded practice and transfer checks.
- Full verification passed: 37 test files, 380 tests.

