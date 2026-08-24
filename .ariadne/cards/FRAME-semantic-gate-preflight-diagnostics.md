# FRAME-semantic-gate-preflight-diagnostics: Semantic-gate candidate-breadth preflight

- Status: ACTIVE
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-08-24

## Statement

Before the semantic gate evaluates an active contradiction, it must explain insufficient candidate breadth and uncovered separation principles without mutating the graph, while a complete candidate set must still pass the unchanged hard gate.

## Payload

```json
{
  "falsification_conditions": [
    "A partial graph still reaches only a generic rejection without the preflight explanation",
    "The diagnostic appends candidate or edge events",
    "A completed three-candidate graph no longer passes"
  ],
  "source": "/mnt/c/Users/bulky/Projects/ariadne/.scratch/ariadne-uncertainty-ingress/issues/05-semantic-gate-preflight-diagnostics.md",
  "constraints": [
    "diagnostic is read-only",
    "hard gate remains strict",
    "completed three-candidate graph passes"
  ]
}
```
