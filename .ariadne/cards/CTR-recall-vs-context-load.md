# CTR-recall-vs-context-load: Recall versus context load

- Status: OPEN
- Provenance: PROPOSED
- Type: CTR
- Revised: 2026-09-07

## Statement

A broader Ariadne uncertainty signal improves recall of genuinely uncertain work but increases context load and false-positive activation for routine work.

## Payload

```json
{
  "falsification_conditions": [
    "A single broad trigger shows no measurable increase in false-positive activation.",
    "A staged signal misses ambiguous design work that the canonical trigger should catch."
  ],
  "separation_principle": "operating condition",
  "parameter_a": "activation recall",
  "parameter_b": "context load and false positives",
  "resolution_target": "Use a two-stage signal: concise canonical triggers in the root description, then a targeted uncertainty rule that confirms decision significance before loading deeper rules."
}
```
