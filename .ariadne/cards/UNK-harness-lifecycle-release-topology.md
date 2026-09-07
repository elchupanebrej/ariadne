# UNK-harness-lifecycle-release-topology: Harness lifecycle release topology

- Status: RESOLVED
- Provenance: DECIDED
- Type: UNK
- Revised: 2026-09-07

## Statement

Independent owner versions are assembled into immutable tested release bundles; lockstep releases and use-time range resolution are rejected.

## Payload

```json
{
  "owner": "Method Contract and component owners",
  "affected_candidates": [
    "CAN-lockstep-harness-release",
    "CAN-independent-harness-versions",
    "CAN-tested-harness-release-bundle"
  ],
  "decision_deadline": "resolved in ticket 12 round 1",
  "outcomes": [
    "Selected: independent components assembled into immutable tested bundles"
  ],
  "resolved_by": "DEC-harness-release-topology"
}
```
