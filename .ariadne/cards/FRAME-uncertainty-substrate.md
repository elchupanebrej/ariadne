# FRAME-uncertainty-substrate: Uncertainty-first Ariadne substrate

- Status: OPEN
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-09-07

## Statement

For work with decision-significant uncertainty, Ariadne detects the uncertainty, records an epistemic substrate, and hands that substrate to the next reasoning skill before grilling, specification, ticketing, or implementation.

## Payload

```json
{
  "falsification_conditions": [
    "A deliberately ambiguous task reaches grill/spec/tickets without Ariadne artifacts.",
    "A routine known-answer question activates the full uncertainty flow."
  ],
  "context": "The root Ariadne skill must interoperate with grill-me/grill-with-docs and Matt delivery skills without duplicating their ownership.",
  "required_behavior": "Detect decision-significant uncertainty and produce linked epistemic artifacts that preserve facts, unknowns, assumptions, contradictions, candidate mechanisms, provenance, and the current decision frontier.",
  "proposed_mechanism": "Ariadne-owned uncertainty ingress and handoff contract routed from the model-invoked root skill.",
  "preconditions": [
    "A task contains ambiguous requirements, an unknown fact, an assumption, competing explanations or candidates, a contradiction, or a risky transition."
  ],
  "postconditions": [
    "Ariadne artifacts exist before downstream grilling or delivery work.",
    "The downstream skill receives a compact handoff with explicit unresolved decisions and provenance."
  ],
  "invariants": [
    "Ariadne owns epistemic state.",
    "Matt skills own grilling, specification, ticketing, and implementation.",
    "Unknowns remain unresolved until discriminating evidence exists.",
    "No duplicate delivery plan is created by Ariadne."
  ],
  "constraints": [
    "The trigger must be broad enough to catch uncertainty but narrow enough to avoid activating for routine known-answer work.",
    "The root skill must preserve progressive disclosure."
  ],
  "behavioral_delta": "Current root routing names specialized reasoning topics but does not explicitly define a general uncertainty ingress or downstream substrate contract.",
  "perspectives": [
    "User needs to understand why questions appear and what is unresolved.",
    "Grill skill needs a prepared decision tree rather than raw ambiguity.",
    "Downstream delivery skills need stable facts and decisions without owning epistemic reasoning.",
    "Future maintainers need one Ariadne-owned trigger and handoff contract."
  ],
  "unknowns": [
    "UNK-uncertainty-trigger-boundary",
    "UNK-grill-handoff-shape",
    "UNK-auto-handoff-policy"
  ],
  "contradictions": [
    "CTR-recall-vs-context-load"
  ],
  "observability": "A test task with an ambiguous design request produces FRAME plus linked unknown/assumption/contradiction artifacts before grill questions."
}
```
