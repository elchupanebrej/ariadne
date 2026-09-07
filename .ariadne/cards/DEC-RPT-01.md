# DEC-RPT-01: Delivery: CLI renders, skill mandates embedding

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Option c chosen: the ariadne report command renders the report deterministically from the graph, and a skill rule obliges the agent to invoke it and embed the output in its answer. Option a (agent renders alone) rejected as non-deterministic across sessions; option b (CLI only) rejected as not guaranteeing the user sees it.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: in host mode without the CLI the report is unavailable; mitigation - rule 05 keeps a manual ASCII format as degradation."
}
```
