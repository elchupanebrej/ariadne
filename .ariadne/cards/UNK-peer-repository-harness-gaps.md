# UNK-peer-repository-harness-gaps: Peer repository harness gaps

- Status: RESOLVED
- Provenance: MEASURED
- Type: UNK
- Revised: 2026-09-07

## Statement

It is unknown whether Matt Pocock Skills, OpenGSD, OpenSpec, or OpenCode expose repository-observable harness behavior absent from Ariadne and worth adopting without duplicating owner state.

## Payload

```json
{
  "falsification_conditions": [
    "A claimed gap is already implemented and covered by a runnable Ariadne check",
    "A peer mechanism requires copied workflow or epistemic state inside the harness",
    "The mechanism improves presentation only and cannot change a clean-session outcome"
  ],
  "question": "Which peer-repository mechanisms close an observable Ariadne harness gap rather than merely offering a different style or broader product scope?",
  "owner": "Ariadne maintainer",
  "affected_candidates": [
    "CAN-thin-owner-artifact-baseline",
    "CAN-colocated-neutral-file-kernel",
    "CAN-dedicated-orchestration-runtime"
  ],
  "outcomes": [
    {
      "value": "No missing hard behavior",
      "effect": "Keep the current thin or colocated boundary and make no architectural addition."
    },
    {
      "value": "One or more missing hard behaviors",
      "effect": "Create only candidates tied to those observed gaps and test them against current ownership invariants."
    }
  ],
  "deadline": "2026-08-30",
  "observed_value": "Missing hard behaviors are bounded graph-native continuation guidance and portable release packaging. The existing attempt protocol should remain; a broader runtime would duplicate host or owner state.",
  "evidence": [
    "EVD-peer-repository-harness-patterns"
  ],
  "resolution": "Close the observed gaps through the existing CLI, skill, and package boundaries; do not add a workflow or host runtime."
}
```
