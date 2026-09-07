# CAN-staged-snapshot-fixed-point: Staged immutable snapshot fixed point

- Status: SELECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Build each authoring and orchestration artifact from pinned prior snapshots, then let the harness coordinate two isolated complete self-applications and compare their normalized P/A/R/L candidates with the pinned input core.

## Payload

```json
{
  "falsification_conditions": [
    "A stage requires a live callback into its builder",
    "A fixed-point pass can succeed with one assessment or an empirical receipt",
    "Two core-changing outputs can be treated as equivalent by normalization"
  ],
  "mechanism_class": "owner-gated immutable bootstrap rounds",
  "separation_principle": "Time",
  "state_owner": "the Method Contract owner owns normative candidates; the harness owns attempt pointers and gates; assessors own self-application receipts",
  "supported_invariants": [
    "acyclic runtime graph",
    "complete executable F",
    "immutable provenance",
    "independent assessments",
    "external verification remains separate"
  ],
  "known_constraints": [
    "a normative delta starts a new owner-approved round",
    "schema equivalence is conservatively structural after normalization",
    "clean-session effectiveness remains a downstream evidence gate"
  ]
}
```
