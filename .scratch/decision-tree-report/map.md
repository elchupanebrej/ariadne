# Wayfinder map: Decision-tree research report

Label: wayfinder:map
Status: open

## Destination

At the end of an investigation ariadne produces a report: a traversal tree from the posed problem with intermediate answers, a complete decision change log (why exactly this path was chosen), an ASCII visualization of accepted decisions, and links to card files; all emitted paths are project-root-relative. The change lands in code and in the skill contract.

## Notes

- All design decisions are captured in the epistemic graph as `DEC-RPT-01`..`DEC-RPT-13` (see `.ariadne/GRAPH.jsonl`, strict gates green). Tickets must build on the corresponding DECs rather than re-opening the choices.
- Skills for sessions: `codebase-design` when designing the render, `tdd` when implementing, `writing-for-agents` when rewriting skill rules.
- Standing preference: ponytail full — minimal diffs, no speculative abstractions.
- Modes: standalone base is `.ariadne/`, gsd mirror is `.planning/ariadne/`; one logic, differing root only.
- All documentation in this repository is written in English.

## Decisions so far

- [DEC-RPT-01..13, ASM-RPT-01..02, CTR-RPT-01](.ariadne/GRAPH.jsonl) — every design decision from the dialogue is captured as cards with rationales and adversarial critique; full summary in the tickets below.
- [T1 resolved](issues/01-prototype-tree-grammar.md) — the ASCII report grammar fixed by prototype: node line `<prefix>|-- <edge-type> --> <ID> [STATUS] title` + answer line `~ …` beneath (UNK→resolved_by, EVD→verdict, DEC/EVDREQ→first sentence of statement), change log = 3 lines per event (action/card/reason, filter CAN/DEC/EVD/UNK+tombstones: 177 of 277). Caveat: DEC-RPT-08's root wording diverges from actual edge orientation. Script: `scripts/proto-tree.mjs`. Human reaction pending, orchestrator will collect it.

## Not yet specified

- JSON schema of `ariadne report --json` output: shape of nodes/edges/log steps undecided until the text-format prototype.
- Rendering deductive cycles (CTR instead of a cycle) inside the tree: rule exists in 00-core, visual form not chosen.
- Whether `ariadne verify` should gate the report (fail on an invalid tree) — a quality question, surfaces after T3.

## Out of scope

- Graph storage format: append-only GRAPH.jsonl stays unchanged.
- Anything beyond ASCII output: TUI/HTML/image exports.
- Policy for pruning old reports and dead cards: directory growth accepted deliberately.
