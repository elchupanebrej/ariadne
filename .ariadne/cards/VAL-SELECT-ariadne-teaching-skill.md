# VAL-SELECT-ariadne-teaching-skill: Select task-first progressive Ariadne teaching

- Status: SELECTED
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-08-24

## Statement

Select the task-first progressive worked example after the reference-manual and Method Contract wrapper candidates fail hard teaching and ownership requirements.

## Payload

```json
{
  "hard_requirements": [
    "meaningful task appears before the concept catalog",
    "only triggered Ariadne rules are loaded",
    "Ariadne remains the epistemic source of truth",
    "the Method Contract remains the normative source of truth",
    "one complete worked example produces valid artifacts",
    "self-explanation, fading, transfer, and a runnable check are present"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-task-first-progressive-teaching",
      "result": "PASS",
      "failures": []
    },
    {
      "candidate": "CAN-reference-manual-teaching",
      "result": "FAIL",
      "failures": [
        "progressive disclosure",
        "source ownership"
      ]
    },
    {
      "candidate": "CAN-method-contract-wrapper-teaching",
      "result": "FAIL",
      "failures": [
        "single normative source",
        "change locality"
      ]
    }
  ],
  "preference_observations": {
    "useful_effect": "one compact end-to-end path from task to evidence-backed decision",
    "mechanism_cost": "one entry skill, one worked-example document, one isolated fixture, and one check",
    "mutable_state_cost": "only normal Ariadne graph artifacts",
    "infrastructure_cost": "none beyond Ariadne and Node already in the repository",
    "operational_harm": "the first lesson covers only a subset of operations",
    "cognitive_load": "router plus only branch-triggered rules",
    "change_radius": "teaching package and clean-session evaluation"
  },
  "evidence_rung": 3,
  "evidence": "EVD-ariadne-teaching-flow-prototype-r3",
  "assumptions": [
    "A small parser decision is representative enough to teach source ownership and evidence matching"
  ],
  "unknowns": [
    "clean-session completion and transfer rate"
  ],
  "adversarial_critique": [
    {
      "attack": "The parser example is too trivial to teach Ariadne.",
      "response": "It is intentionally small enough for a complete local Rung 3 check while still requiring Frame, Explore, Value, Validate, source ownership, and evidence-class discipline."
    },
    {
      "attack": "Progressive routing may eventually load several rules.",
      "response": "The prohibition is preloading; each source is opened only when its trigger fires, and unrelated Diagnose, Transform, Knowledge, Dependencies, and Dynamics rules remain unloaded in the worked path."
    },
    {
      "attack": "The teaching check could be mistaken for effectiveness evidence.",
      "response": "The receipt is limited to flow logic at Rung 3; ticket 11 retains clean-session effectiveness and transfer evaluation."
    },
    {
      "attack": "Example prose can drift from Ariadne rules.",
      "response": "The entry skill links the live router and rules, and the example records case-specific decisions rather than restating rule definitions."
    }
  ],
  "selection": "CAN-task-first-progressive-teaching",
  "next_evidence_requests": [
    "ticket 11 clean-session evaluation"
  ]
}
```
