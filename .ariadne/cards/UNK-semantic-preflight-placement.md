# UNK-semantic-preflight-placement: Semantic preflight ownership seam

- Status: RESOLVED
- Provenance: UNKNOWN
- Type: UNK
- Revised: 2026-08-24

## Statement

Which seam should own candidate-breadth preflight diagnostics: a pure semantic-gate helper, the CLI gate command, or both?

## Payload

```json
{
  "falsification_conditions": [
    "The chosen seam cannot expose the diagnostic before partial graph construction",
    "The chosen seam mutates graph state"
  ],
  "source": "/mnt/c/Users/bulky/Projects/ariadne/.scratch/ariadne-uncertainty-ingress/issues/05-semantic-gate-preflight-diagnostics.md",
  "resolved_by": "DEC-semantic-gate-preflight-contract"
}
```
