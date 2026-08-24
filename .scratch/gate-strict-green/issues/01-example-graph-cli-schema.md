# 01 — Example graph speaks the CLI schema

**What to build:** The teach-ariadne worked example's graph (`example/.ariadne/GRAPH.jsonl`) becomes loadable by the real `ariadne` CLI, so the lesson's "gate the graph" step is truthful rather than illustrative. All teaching semantics survive the conversion: FRAME, SPACE, three structurally distinct CANs, VAL-SELECT with its adversarial critique, EVDREQ (rung 3), EVD receipt linked to its request, and the locking DEC — plus the relational edges between them.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] `node dist/cli/index.js gate structural --strict`, run with cwd = `.agents/skills/teach-ariadne/example`, exits clean
- [ ] Same for `semantic --strict` and `epistemic --strict`
- [ ] Every node/edge from the original example graph is represented with equivalent meaning (no dropped cards)
- [ ] `node .agents/skills/teach-ariadne/example/check.mjs` still passes (its required-node IDs are preserved)

## Comments

Done. Graph converted to kind-wrapped node/edge events; three edges retyped for endpoint-contract legality (`SPACE→FRAME` and `CAN*→SPACE` became `references`; `DEC→EVD` became `derived_from`, since EVD is not a legal depends_on target); locked DEC and VAL-SELECT gained substantive adversarial critiques; EVDREQ/EVD gained explicit claim_class/request linkage fields. All strict gates pass with cwd = example dir.

Correction: five edges were retyped for endpoint-contract legality (SPACE→FRAME and three CAN→SPACE became `references`; DEC→EVD became `derived_from`), not three as first written. VAL-SELECT critique now preserves the original two attacks verbatim and adds the encoding/locale attack in sibling `{attack,response}` array shape.

Re-verified 2026-08-24 after the teach-*→methodize-* rename (08103b8): example now lives at `.agents/skills/methodize-ariadne/example`. All acceptance criteria pass at the new path — structural/semantic/epistemic `--strict` gates exit clean with cwd = example dir; `check.mjs` passes; diffed pre-70b8169 graph against current: all 9 nodes and 9 edges preserved with equivalent meaning (only endpoint-contract edge retypes and additive fields). Full suite green: 54 files, 558 tests.
