# 05 — Semantic-gate preflight diagnostics

**What to build:** Detect insufficient candidate breadth before the semantic gate rejects a partially constructed uncertainty graph, and explain the required separation principles without weakening the gate.

**Blocked by:** None.

**Status:** ready-for-human

**Source:** [OBS-ariadne-tooling-failures](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl), [spec.md](/mnt/c/Users/bulky/Projects/ariadne/.scratch/ariadne-uncertainty-ingress/spec.md)

- [x] Before running the semantic gate, detect an active contradiction such as [CTR-recall-vs-context-load](/mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl) that requires candidate breadth.
- [x] Report the minimum number of structurally distinct candidates and the separation principles required by the active gate.
- [x] Show which candidate principles already exist and which dimensions remain uncovered.
- [x] Make the diagnostic read-only: it must not create partial candidate cards or mutate graph state.
- [x] Preserve the existing hard gate: a diagnostic must not make an incomplete candidate set pass.
- [x] Add a regression fixture proving that the diagnostic appears before partial graph construction and that the completed three-candidate graph still passes.

The observed run needed candidates spanning operating condition, time, and
system boundary before the gate passed. The issue is diagnostic timing and
remediation clarity, not the requirement for structurally distinct candidates.

## Comments

- Acceptance verified on 2026-08-21: preflight runs before the semantic gate, reports required/actual candidates plus covered/uncovered principles, remains read-only, and incomplete candidate sets still fail the strict gate.
- Focused gate suite passes: 12/12 tests. Direct mode check confirms Standard and Deep reject one candidate with multiple principles, Fast accepts one, and Deep accepts three.
- Review from fixed point `936a2f7`: Standards has no hard violations; Spec has no blocking findings. The advisory for duplicated breadth calculations was fixed by consolidating the shared logic.
- Full `npm run verify` passes: 32 test files and 243 tests.
