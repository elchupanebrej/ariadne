# VAL-SELECT-staged-fixed-point-contract: Select staged fixed-point contract

- Status: SELECTED
- Provenance: PROPOSED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select staged immutable snapshots after filtering live recursion and detached audit on hard requirements; no preference score compensates for either failure.

## Payload

```json
{
  "hard_requirements": [
    "F is executed as complete self-application",
    "runtime dependency graph is acyclic",
    "all inputs are immutable version and digest pins",
    "two complete independent assessments agree",
    "P/A/R/L deltas fail closed",
    "external empirical evidence remains a separate receipt class",
    "the Method Contract owner alone accepts normative deltas"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-live-recursive-self-hosting",
      "result": "FAIL",
      "failures": [
        "runtime acyclicity",
        "immutable provenance",
        "single failure owner"
      ]
    },
    {
      "candidate": "CAN-detached-fixed-point-audit",
      "result": "FAIL",
      "failures": [
        "complete executable F",
        "single normative source"
      ]
    },
    {
      "candidate": "CAN-staged-snapshot-fixed-point",
      "result": "PASS",
      "failures": []
    }
  ],
  "preference_observations": {
    "useful_effect": "one explicit path from bootstrap to structural v1",
    "mechanism_cost": "one immutable lock and two assessment bundles per round",
    "mutable_state_cost": "attempt pointers only; no live self-rewrite",
    "infrastructure_cost": "no service, queue, database, or scheduler required",
    "operational_harm": "normative delta stops for owner action",
    "cognitive_load": "one build DAG and one smaller runtime DAG",
    "change_radius": "Method Contract, two authoring skills, orchestration artifact, and receipts"
  },
  "evidence_rung": 3,
  "evidence": "EVD-staged-fixed-point-prototype",
  "assumptions": [
    "full contract projection can preserve the P/A/R/L boundary defined by the guide"
  ],
  "unknowns": [
    "clean-session teaching effectiveness",
    "real adapter compatibility",
    "whether the neutral kernel survives its deletion comparison"
  ],
  "adversarial_critique": [
    {
      "attack": "Normalization could hide a schema or link change.",
      "response": "Only release-instance metadata and representation order are erased; schema, rule, completion, hook, lifecycle-policy, and normative-link changes count as core changes by default."
    },
    {
      "attack": "Two assessments can repeat the same hidden bias.",
      "response": "Receipts record isolated contexts and no access to peer output; downstream clean-session evaluation strengthens, but does not redefine, this structural gate."
    },
    {
      "attack": "Bootstrap assumptions can be laundered into v1.",
      "response": "Self-application cannot raise A2 evidence classes or satisfy external verification hooks; every rationale retains its prior provenance."
    },
    {
      "attack": "The harness could silently become the method owner.",
      "response": "It validates pins and receipts only; any normative delta stops and requires Method Contract owner acceptance in a new round."
    },
    {
      "attack": "Rebuilding v1 could recreate the cycle.",
      "response": "The final release set points to one fixed immutable round; build provenance and runtime invocation remain separate DAGs."
    }
  ],
  "selection": "CAN-staged-snapshot-fixed-point",
  "next_evidence_requests": [
    "ticket 11 clean-session evaluation",
    "ticket 09 adapter contract prototype"
  ]
}
```
