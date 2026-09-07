# CAN-pointer-only-matt-ariadne-adapters: Pointer-only owner adapters

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Use one small lifecycle adapter surface implemented under each owner: capability discovery plus start, resume, cancel, and event polling; exchange only pinned requests and owner-issued receipt, artifact, pending-action, diagnostic, and trace pointers, while Matt owns workflow meaning, Ariadne owns graph meaning, and the host owns actual execution and process cancellation.

## Payload

```json
{
  "falsification_conditions": [
    "A required flow cannot be represented without copying Matt workflow state or Ariadne graph payloads into harness state",
    "Direct Matt or Ariadne use must be intercepted to preserve correctness",
    "Cancellation requires the harness to infer or compensate an owner side effect",
    "The shared lifecycle surface cannot express both owners without branching on their semantics"
  ],
  "non_responsibilities": [
    "skill procedure semantics",
    "epistemic node semantics",
    "human answers",
    "host permissions and process state",
    "tracker mutations",
    "cross-owner transactions"
  ]
}
```
