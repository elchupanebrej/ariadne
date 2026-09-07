# SPACE-peer-harness-continuation: Peer-informed harness continuation space

- Status: OPEN
- Provenance: PROPOSED
- Type: SPACE
- Revised: 2026-08-30

## Statement

Compare the smallest mechanisms that let a fresh session continue one Ariadne frame without duplicating graph or host ownership.

## Payload

```json
{
  "behavior": "Given a frame identifier and repository artifacts, return one bounded, executable next action and explain blocking dependencies.",
  "hard_invariants": [
    "Ariadne remains the only epistemic-state owner",
    "Host owns sessions, permissions, retries, compaction, and snapshots",
    "Matt-style skills retain their own workflow semantics",
    "Direct Ariadne use remains valid",
    "No hidden conversational state is required"
  ],
  "dimensions": {
    "state_owner": [
      "existing graph",
      "small orientation snapshot",
      "dedicated runtime"
    ],
    "execution_mode": [
      "derive on demand",
      "update after actions",
      "runtime lifecycle"
    ],
    "failure_boundary": [
      "stale graph",
      "stale snapshot",
      "second authoritative state"
    ],
    "system_boundary": [
      "existing CLI",
      "repository orientation file",
      "new orchestration component"
    ]
  },
  "nine_box": {
    "subsystem_past": "Rules selected an operation but did not orient the next record.",
    "subsystem_present": "CLI exposes graph state and reports.",
    "subsystem_future": "One frame-scoped response supplies the next operation and template.",
    "system_past": "Fresh sessions reconstructed continuation from many artifacts.",
    "system_present": "The graph is durable but status is unbounded.",
    "system_future": "The graph remains authoritative and handoffs carry only a frame pointer.",
    "supersystem_past": "Hosts and skills supplied their own lifecycle behavior.",
    "supersystem_present": "Peers expose richer orientation and host services.",
    "supersystem_future": "Ariadne consumes host boundaries without re-owning them."
  },
  "candidate_classes": [
    "CAN-graph-native-frame-continuation",
    "CAN-persisted-active-frame-spine",
    "CAN-dedicated-orchestration-runtime"
  ],
  "pruned_combinations": [
    {
      "combination": "OpenCode-like host runtime inside Ariadne",
      "reason": "violates host ownership"
    },
    {
      "combination": "OpenGSD-like workflow phase engine inside Ariadne",
      "reason": "violates epistemic-overlay scope"
    },
    {
      "combination": "second artifact graph",
      "reason": "duplicates Ariadne graph authority"
    }
  ],
  "active_contradictions": [],
  "evidence": [
    "EVD-peer-repository-harness-patterns"
  ]
}
```
