# VAL-SELECT-harness-authoring-teaching-skill: Select failure-driven source-pinned harness teaching

- Status: SELECTED
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-08-24

## Statement

Select the failure-driven source-pinned vertical slice after catalog-first and framework-first candidates fail hard pedagogy, ownership, and falsifiability requirements.

## Payload

```json
{
  "dependencies": [
    "CAN-failure-driven-harness-vertical-slice",
    "CAN-harness-capability-catalog",
    "CAN-framework-first-harness-lab",
    "DEP-harness-authoring-bootstrap-boundary",
    "EVD-harness-authoring-teaching-flow-prototype-r3"
  ],
  "hard_requirements": [
    "a meaningful harness task and repository outcomes appear before the mechanism catalog",
    "G_n, M_n, MA_n, harness research, workspace, and host capabilities are pinned",
    "the thin baseline is an eligible candidate and a passing baseline deletes the kernel",
    "method, tracker, Ariadne, host, and harness state retain one owner each",
    "mechanisms are added only on observable continuation, artifact, approval, replay, trace, adapter, or version triggers",
    "one complete example covers cold start, resume, approval, ambiguous effects, invalid artifacts, pin drift, and adapter conformance",
    "artifacts carry pointers, pins, receipts, and predicates rather than copied owner semantics",
    "the lesson includes recovery, self-explanation, fading, transfer, and a runnable check",
    "self-application uses immutable build rounds and no active runtime recursion"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-failure-driven-harness-vertical-slice",
      "result": "PASS",
      "failures": []
    },
    {
      "candidate": "CAN-harness-capability-catalog",
      "result": "FAIL",
      "failures": [
        "meaningful-task-first",
        "progressive trigger loading",
        "runtime deletion test"
      ]
    },
    {
      "candidate": "CAN-framework-first-harness-lab",
      "result": "FAIL",
      "failures": [
        "requirements before mechanism",
        "host-neutral behavior",
        "single state ownership",
        "implementation after boundary selection"
      ]
    }
  ],
  "preference_observations": {
    "useful_effect": "one end-to-end path from observable lifecycle failure to the smallest owner-safe design",
    "mechanism_cost": "one entry skill, one worked-example bundle, and one deterministic check",
    "mutable_state_cost": "lesson progress and fixture results only",
    "infrastructure_cost": "none in the teaching package",
    "operational_harm": "the first lesson exercises one workflow and one provisional adapter boundary",
    "cognitive_load": "task and tests first, then only failed-invariant triggers",
    "change_radius": "teaching package, bootstrap pins, OH_n design handoff, and ticket 11 fixtures"
  },
  "evidence_rung": 3,
  "evidence": "EVD-harness-authoring-teaching-flow-prototype-r3",
  "assumptions": [
    "The dependency-review continuation example is representative enough to expose the required owner, replay, approval, artifact, trace, and lifecycle decisions."
  ],
  "unknowns": [
    "clean-session independent completion and transfer rate",
    "real-host adapter conformance",
    "whether the thin baseline can satisfy the full destination invariants"
  ],
  "adversarial_critique": [
    {
      "attack": "Using the target Orchestration Harness as the worked example may overfit the lesson.",
      "response": "A faded issue-triage case and a changed self-application transfer withhold ownership and mechanism choices; ticket 11 tests clean-session transfer."
    },
    {
      "attack": "A pinned research snapshot can age into stale practice.",
      "response": "Research digest and as-of date are inputs, and lifecycle triggers require review when provider contracts, standards, or observed failures change."
    },
    {
      "attack": "A harness-authoring skill that can conclude no kernel exists appears self-defeating.",
      "response": "The taught capability is boundary design; deleting an unjustified runtime is a valid and required design outcome."
    },
    {
      "attack": "The passing prototype could be mistaken for recovery or pedagogy evidence.",
      "response": "The receipt is limited to Rung 3 algorithmic flow; ticket 11 retains integration, clean-session, and empirical evaluation."
    },
    {
      "attack": "The example design bundle could become a shadow Method Contract.",
      "response": "It stores source pins, selected candidate, pointer-only schemas, and outcomes; normative method rules and owner semantics remain referenced at their sources."
    }
  ],
  "selection": "CAN-failure-driven-harness-vertical-slice",
  "next_evidence_requests": [
    "ticket 11 clean-session teaching evaluation",
    "ticket 09 real adapter contracts",
    "ticket 10 recovery and security semantics"
  ]
}
```
