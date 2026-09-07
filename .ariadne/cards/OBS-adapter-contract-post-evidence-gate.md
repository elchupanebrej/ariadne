# OBS-adapter-contract-post-evidence-gate: Adapter-contract task-local graph checks pass

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

After lowering the dependency card to the strongest provenance expressible by the current edge schema, structural and semantic gates pass and strict verification reports no diagnostic against the adapter-contract nodes; two pre-existing repository-wide epistemic diagnostics remain.

## Payload

```json
{
  "command": "node dist/cli/index.js verify --strict",
  "task_local_nodes": [
    "CAN-pointer-only-matt-ariadne-adapters",
    "DEP-matt-ariadne-adapter-boundary",
    "EVDREQ-matt-ariadne-adapter-prototype-r3",
    "EVD-matt-ariadne-adapter-prototype-r3",
    "VAL-SELECT-matt-ariadne-adapter-contract",
    "DEC-matt-ariadne-adapter-contract"
  ],
  "result": {
    "structural": "passed",
    "semantic": "passed",
    "task_local_epistemic": "passed",
    "repository_wide_epistemic": "blocked"
  },
  "residual_diagnostics": [
    {
      "node": "EVDREQ-clean-session-runtime-necessity",
      "code": "MISSING_EVIDENCE_RESULT",
      "ownership": "clean-session verification ticket"
    },
    {
      "node": "DEC-semantic-gate-preflight-contract",
      "code": "MISSING_ADVERSARIAL_CRITIQUE",
      "ownership": "unrelated existing graph decision"
    }
  ],
  "impact": "The accepted adapter contract is internally accepted; repository-wide strict verification remains blocked by two conditions outside this ticket."
}
```
