# EVD-graph-native-harness-contract-r1: Graph-native harness contract research

- Status: SUPPORTED
- Provenance: MEASURED
- Type: EVD
- Revised: 2026-09-03

## Statement

Pinned primary sources plus current-worktree receipts support a graph-native frame continuation contract derivable from existing Ariadne node and edge semantics with no new mutable state, confirm pointer-only handoff sufficient for the observed orientation gap, bound the teaching-runtime deletion to a pre-first-publish export trim, and define the minimum typed package surface and one real-host adapter contract test.

## Payload

```json
{
  "verdict": "SUPPORTED",
  "method": "Static inspection of pinned upstream revisions (mattpocock/skills, open-gsd/gsd-core, Fission-AI/OpenSpec, anomalyco/opencode) plus current-worktree call-site audit, line counts, npm pack --dry-run --json measurement, npm run verify, and ariadne verify --strict",
  "rung": 3,
  "receipt": "docs/research/graph-native-harness-contract.md",
  "environment": "Ariadne worktree on WSL linux, Node 26, 2026-09-03",
  "claim_class": "Architectural boundary",
  "observations": [
    "OpenSpec agent contract derives ordered readiness, requires/missingDeps, and unlocks from artifact existence alone, no workflow engine",
    "Ariadne graph already carries node types, provenance, terminality (isFrontierNode), edge endpoint contracts, and EVD verdicts needed for frame-scoped readiness",
    "report/status currently emit no next_action, operation, dependencies, or unlocks (confirms EVD-frame-continuation-prototype-r3)",
    "teach-* modules have no non-test, non-star-export consumer; packaged methodize-harness example uses only node builtins",
    "npm pack --dry-run: 129 files, 904382 bytes, teach files 260109 bytes = 28.8 percent",
    "package has never been published; teaching export removal is safe pre-first-publish and major-only after",
    "npm run verify PASS 63 files 657 tests; ariadne verify --strict PASS"
  ],
  "limitations": [
    "no host adapter contract test exists yet; no host-integration claim made",
    "continuation priority rules are a design validated only against peer evidence, not implemented"
  ],
  "falsification_result": "No evidence found that a persisted orientation spine or dedicated orchestration runtime is justified; teaching runtime deletion falsified only for published-consumer risk after first publish."
}
```
