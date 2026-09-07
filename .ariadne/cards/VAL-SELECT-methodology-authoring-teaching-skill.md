# VAL-SELECT-methodology-authoring-teaching-skill: Select task-first contract-pinned methodology teaching

- Status: SELECTED
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select the task-first contract-pinned vertical slice after the artifact catalog and shadow-contract candidates fail hard pedagogy and ownership requirements.

## Payload

```json
{
  "hard_requirements": [
    "a meaningful authoring task appears before the artifact taxonomy",
    "one Method Contract version and digest remain the normative source",
    "A0 is drafted before specialized artifacts and stays concise",
    "every A1-A7 expansion has an observed signal",
    "material rules resolve through stable rationale references",
    "external verification and self-consistency use distinct receipts",
    "the skill never invokes or rewrites itself",
    "one complete example, targeted recovery, self-explanation, fading, transfer, and a runnable check are present"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-task-first-method-vertical-slice",
      "result": "PASS",
      "failures": []
    },
    {
      "candidate": "CAN-artifact-catalog-method-teaching",
      "result": "FAIL",
      "failures": [
        "meaningful-task-first",
        "progressive expansion",
        "change locality"
      ]
    },
    {
      "candidate": "CAN-shadow-contract-method-teaching",
      "result": "FAIL",
      "failures": [
        "single normative source",
        "pin integrity",
        "rationale traceability",
        "fixed-point ownership"
      ]
    }
  ],
  "preference_observations": {
    "useful_effect": "one end-to-end path from authoring task to traceable verified guide bundle",
    "mechanism_cost": "one entry skill, one worked-example bundle, and one check",
    "mutable_state_cost": "only normal guide artifacts and owner receipts",
    "infrastructure_cost": "none beyond the pinned contract consumer and host adapter",
    "operational_harm": "the first lesson covers one guide domain",
    "cognitive_load": "A0 first, then only triggered artifact and rationale sections",
    "change_radius": "teaching package and clean-session evaluation"
  },
  "evidence_rung": 3,
  "evidence": "EVD-methodology-authoring-teaching-flow-prototype-r3",
  "assumptions": [
    "A dependency-change review guide is representative enough to trigger all A1-A7 expansions and expose rationale, recovery, and lifecycle decisions"
  ],
  "unknowns": [
    "clean-session independent completion and transfer rate"
  ],
  "adversarial_critique": [
    {
      "attack": "A complete A1-A7 example conflicts with progressive disclosure.",
      "response": "The learner drafts A0 first; the scenario deliberately contains one observed expansion signal for each specialized artifact, and every expansion records that signal."
    },
    {
      "attack": "One domain example may teach copying instead of contract interpretation.",
      "response": "The faded incident-handoff case withholds expansion and trace decisions, while the metamethodological transfer changes both domain and completion profile."
    },
    {
      "attack": "Self-application risks recursive self-invocation.",
      "response": "The transfer selects pinned immutable assessment bundles and separate receipts; the teaching skill never invokes or rewrites its active instance."
    },
    {
      "attack": "The passing prototype could be mistaken for teaching evidence.",
      "response": "The receipt is limited to algorithmic flow at Rung 3; ticket 11 retains clean-session and empirical evaluation."
    },
    {
      "attack": "Example rationale prose can drift from the long guide.",
      "response": "The example stores case-specific inference and stable rationale references, never copied normative explanations."
    }
  ],
  "selection": "CAN-task-first-method-vertical-slice",
  "next_evidence_requests": [
    "ticket 11 clean-session evaluation"
  ]
}
```
