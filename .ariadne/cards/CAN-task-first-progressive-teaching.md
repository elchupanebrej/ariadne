# CAN-task-first-progressive-teaching: Task-first progressive Ariadne lesson

- Status: SELECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Start with one small repository task, route each uncertainty through Ariadne SKILL.md, load only triggered operation and cross-cutting rules, persist a complete example, then use self-explanation, one faded case, one transfer case, and one runnable check.

## Payload

```json
{
  "mechanism_class": "task-first progressive worked example",
  "operating_principle": "worked-example fading with rule-on-trigger routing",
  "state_owner": "Ariadne owns graph state; the teaching package owns only lesson progress and example fixtures",
  "system_boundary": "teaching skill and isolated example workspace",
  "supported_invariants": [
    "single normative sources remain external",
    "matched evidence receipt",
    "task before terminology",
    "progressive disclosure"
  ],
  "useful_effect": "One end-to-end path demonstrates actual Ariadne use before the learner generalizes.",
  "harm": "The first example covers only a subset of Ariadne operations.",
  "change_radius": [
    "SKILL.md pedagogy",
    "example fixture",
    "check command"
  ],
  "failure_modes": [
    "learner memorizes the example rather than the router",
    "rule links drift after Ariadne changes"
  ],
  "falsification_predicates": [
    "A clean-session learner cannot route the transfer case",
    "The example requires loading unrelated rules"
  ],
  "adversarial_critique": [
    "A single example can overfit; the faded and transfer cases deliberately change both mechanism and causal shape."
  ]
}
```
