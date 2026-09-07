# OBS-self-application-orientation-gap: Self-application orientation gap

- Status: ACTIVE
- Provenance: MEASURED
- Type: OBS
- Revised: 2026-09-07

## Statement

A fresh Ariadne invocation can read the graph but cannot deterministically discover the active frame and one recommended next evidence action from the CLI.

## Payload

```json
{
  "falsification_conditions": [
    "The CLI returns the active frame, unresolved frontier in resolution order, and one schema-valid next-action command",
    "A clean-session test shows agents choose the correct next operation without manual graph/source inspection"
  ],
  "observed_at": "2026-08-30",
  "method": "Use Ariadne itself for the peer-harness research request",
  "commands": [
    "ariadne op knowledge",
    "ariadne status --json"
  ],
  "observations": {
    "frontier_count": 94,
    "open_unknown_count": 4,
    "status_has_current_frame": false,
    "status_has_recommended_next": false,
    "operation_output": {
      "operation": "knowledge",
      "rule": "rules/50-knowledge.md"
    },
    "manual_work_required": [
      "inspect rule and source schemas",
      "construct long node payload JSON",
      "choose graph edges manually"
    ]
  },
  "impact": "Fresh-session continuation still depends on the agent reconstructing workflow orientation from a large frontier rather than a repository-derived next-action contract."
}
```
