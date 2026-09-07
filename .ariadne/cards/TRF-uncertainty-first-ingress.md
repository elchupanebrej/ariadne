# TRF-uncertainty-first-ingress: Replace implicit routing with uncertainty-first ingress

- Status: PROPOSED
- Provenance: PROPOSED
- Type: TRF
- Revised: 2026-09-07

## Statement

Replace specialized-only Ariadne routing with a two-stage uncertainty ingress that recognizes decision-significant uncertainty, loads one targeted uncertainty rule, and emits a substrate for the downstream skill.

## Payload

```json
{
  "falsification_conditions": [
    "Ambiguous design fixtures still bypass Ariadne.",
    "Routine known-answer fixtures activate deep uncertainty handling.",
    "Downstream grill cannot identify the unresolved frontier from the emitted substrate."
  ],
  "source_mechanism": "Current root description and numbered router with no explicit general uncertainty ingress or grill substrate contract.",
  "useful_function": "Recognize uncertainty before downstream work and preserve epistemic state for handoff.",
  "technique_ids": [
    "1.1",
    "1.2",
    "2.4",
    "3.2",
    "3.3",
    "4.1",
    "8.4"
  ],
  "receiver_or_new_boundary": "Ariadne root skill -> rules/05-uncertainty.md -> explicit downstream skill handoff",
  "preserved_invariants": [
    "Ariadne owns epistemic graph semantics.",
    "Matt skills retain ownership of grilling, specification, ticketing, and implementation.",
    "Unknowns remain open until evidence resolves them.",
    "Progressive disclosure remains intact."
  ],
  "new_costs": [
    "A small always-loaded trigger vocabulary.",
    "One additional uncertainty rule file.",
    "A handoff summary that must remain synchronized with linked cards."
  ],
  "failure_modes": [
    "Broad trigger creates false positives.",
    "Too-narrow trigger misses implicit ambiguity.",
    "Handoff summary duplicates or overstates graph state."
  ],
  "transition_plan": "Add trigger and rule contract, run fixture tasks, then adopt as the root route; no external delivery workflow changes.",
  "candidate_refs": [
    "CAN-root-uncertainty-vocabulary",
    "CAN-root-uncertainty-preflight",
    "CAN-cross-skill-wrapper"
  ]
}
```
