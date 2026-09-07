# DEC-RPT-08: Forest by default, single tree by argument

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Chosen: without an argument the report renders a forest of all root FRAMEs; with an argument - a single tree from the given root.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: two FRAMEs claim one subtree; mitigation - root = node without incoming structural edges, ambiguity flagged in the report."
}
```
