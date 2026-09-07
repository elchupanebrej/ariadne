# VAL-SELECT-peer-harness-direction: Select the peer-informed harness direction

- Status: SELECTED
- Provenance: DERIVED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select graph-native frame continuation as the minimum continuation mechanism and portable release cleanup as an orthogonal companion; do not add persistent focus or a broader runtime until evidence proves the graph-only path insufficient.

## Payload

```json
{
  "hard_requirements": [
    "one authoritative epistemic owner",
    "fresh-session continuation from repository artifacts",
    "host-owned session and effect lifecycle",
    "direct Ariadne and skill use remain valid",
    "no hidden conversational state"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-graph-native-frame-continuation",
      "hard_requirement_result": "PASS",
      "preference_observations": "No new mutable state; reuses report/status and graph; smallest change radius.",
      "disposition": "SELECTED"
    },
    {
      "candidate": "CAN-persisted-active-frame-spine",
      "hard_requirement_result": "PASS_CONDITIONALLY",
      "preference_observations": "Improves zero-argument orientation but adds stale derived state, concurrent-frame policy, and crash synchronization.",
      "disposition": "DEFERRED until explicit frame selection is measured insufficient"
    },
    {
      "candidate": "CAN-dedicated-orchestration-runtime",
      "hard_requirement_result": "PASS_CONDITIONALLY",
      "preference_observations": "Existing attempt seam covers the justified atomic lifecycle; broader continuation ownership has the largest state and change radius.",
      "disposition": "REJECTED for the observed orientation gap"
    }
  ],
  "preference_criteria": [
    "reuse of existing mechanism",
    "new mutable-state cost",
    "ownership clarity",
    "cold-start usefulness",
    "change radius",
    "evidence cost"
  ],
  "selection": "CAN-graph-native-frame-continuation",
  "companion": "CAN-portable-minimal-release-contract",
  "useful_effects": [
    "one bounded next action per frame",
    "portable documented package and skills",
    "smaller public and teaching surface"
  ],
  "harms": [
    "CLI readiness becomes a maintained contract",
    "public teaching exports require compatibility handling"
  ],
  "evidence": [
    "EVD-peer-repository-harness-patterns"
  ],
  "evidence_rung": 1,
  "assumptions": [
    "A frame identifier can be carried by a pointer-only handoff",
    "Generic graph relationships are sufficient to rank the next operation"
  ],
  "unknowns": [
    "Published consumers of star-exported teaching APIs",
    "Whether representative frame states expose a missing readiness relation"
  ],
  "adversarial_critique": [
    {
      "attack": "An explicit frame does not solve a completely context-free cold start.",
      "response": "The harness handoff should carry one authoritative frame pointer; adding global focus before that proves insufficient creates stale shared state."
    },
    {
      "attack": "Next-action ranking can become a hidden workflow engine.",
      "response": "Derive only from Ariadne node types, evidence requests, dependencies, and gates; return blocked when the graph lacks enough information."
    },
    {
      "attack": "Deleting teaching modules can break users.",
      "response": "Treat star-export removal as a compatibility and release decision and require the external pack contract before deletion."
    },
    {
      "attack": "OpenCode demonstrates richer reliability machinery.",
      "response": "That machinery belongs to the host; preserve Ariadne attempt records and test the real adapter boundary instead of copying it."
    }
  ],
  "next_evidence_requests": [],
  "decision_state": "PROVISIONAL; no DEC lock until both next evidence requests pass or the scope is narrowed explicitly.",
  "next_checks": [
    {
      "candidate": "CAN-graph-native-frame-continuation",
      "minimum_rung": 3,
      "method": "Deterministic frame-continuation examples"
    },
    {
      "candidate": "CAN-portable-minimal-release-contract",
      "minimum_rung": 6,
      "method": "Clean packed-install and skill portability contract"
    }
  ]
}
```
