# DEC-RPT-02: Card files materialized per node

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Option a chosen: every node write generates a .ariadne/cards/<ID>.md file (like INDEX.md) and links point to it; the ban on invented per-card paths in rule 05 is rewritten. Options b (line anchors into GRAPH.jsonl are fragile under compaction) and c (linking the shared graph gives no card path) rejected.

## Payload

```json
{
  "owner": "human",
  "adversarial_critique": "Risk: file and journal desync on failure; mitigation - materialization inside the same storage transaction and regeneration like INDEX."
}
```
