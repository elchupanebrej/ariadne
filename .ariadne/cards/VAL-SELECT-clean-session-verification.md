# VAL-SELECT-clean-session-verification: Select matched clean-session evaluation

- Status: SELECTED
- Provenance: DECIDED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

A non-compensatory filter selects matched held-out Clean-Session Runs and rejects author-guided demonstration and structural self-checks as sufficient empirical proof.

## Payload

```json
{
  "owner": "user via confirmed Wayfinder grilling",
  "hard_requirements": [
    "separate teaching, orchestration, hidden-context, and structural self-consistency claims",
    "new sessions or processes receive only a pinned allowlisted input manifest and whitelisted capabilities",
    "held-out faded and structurally changed transfer tasks expose memorized-example behavior",
    "full and thinner baseline arms use identical task, host, model, pins, tools, and budget",
    "every critical assertion passes every required run; no compensatory score",
    "claims are limited to tested host, model, adapter, task, and version combinations",
    "real adapter conformance is Rung 6 and crash, concurrency, replay, cancellation, and recovery are Rung 8",
    "deterministic gates precede blinded human review",
    "a passing thinner baseline deletes or inlines the added Teaching Skill or neutral kernel"
  ],
  "candidate_results": [
    {
      "candidate": "CAN-matched-clean-session-evaluation",
      "result": "PASS",
      "failures": []
    },
    {
      "candidate": "CAN-author-guided-demonstration-evaluation",
      "result": "FAIL",
      "failures": [
        "hidden author context",
        "no independent transfer",
        "no reproducible input boundary",
        "no matched baseline"
      ]
    },
    {
      "candidate": "CAN-structural-self-check-evaluation",
      "result": "FAIL",
      "failures": [
        "self-consistency is not external evidence",
        "no real boundary conformance",
        "no fault recovery evidence"
      ]
    }
  ],
  "preference_observations": {
    "useful_effect": "bounded reproducible evidence of independent teaching, transfer, boundary conformance, safety, and layer necessity",
    "mechanism_cost": "versioned fixtures, isolated sessions, existing validators, owner receipts, and two reviewer roles",
    "mutable_state_cost": "evaluation manifests, traces, artifact pointers, rubrics, and receipts only",
    "infrastructure_cost": "no new runtime or framework is required by the contract",
    "operational_harm": "strict gates may yield INCONCLUSIVE instead of a convenient aggregate pass",
    "cognitive_load": "one claim matrix, one task matrix, and existing evidence-rung vocabulary",
    "change_radius": "Teaching Skill fixtures, adapter conformance suite, harness failure fixtures, and evaluation receipts"
  },
  "operating_conditions": [
    "tasks and oracles are versioned; the learner receives the full task but not its oracle",
    "the evaluator can isolate workspace visibility and capture tool access",
    "side effects are simulated or disposable",
    "no universal teaching or production reliability claim"
  ],
  "evidence_rung": 3,
  "evidence": [
    "EVD-ariadne-teaching-flow-prototype-r3",
    "EVD-methodology-authoring-teaching-flow-prototype-r3",
    "EVD-harness-authoring-teaching-flow-prototype-r3",
    "EVD-matt-ariadne-adapter-prototype-r3"
  ],
  "assumptions": [
    "advertised hosts expose enough isolation and trace information to audit the declared input boundary",
    "source-only and thin-harness baselines can be run with matched budgets"
  ],
  "unknowns": [
    "Rung 5 validator mutation score",
    "Rung 6 teaching and adapter results",
    "Rung 6 neutral-kernel deletion result",
    "Rung 8 runtime fault-injection result"
  ],
  "adversarial_critique": [
    {
      "attack": "A held-out oracle can become hidden author context.",
      "response": "The evaluator withholds the oracle from the learner and records it by digest; only the fully supplied task enters the input manifest."
    },
    {
      "attack": "Two runs cannot prove population-level pedagogy.",
      "response": "The claim is explicitly bounded to the tested fixtures and environment combinations; no universal learning-effect claim is made."
    },
    {
      "attack": "A weaker baseline can manufacture an apparent teaching benefit.",
      "response": "Both arms receive identical tasks, normative sources, host, model, tools, budget, and pins; only the Teaching Skill or neutral kernel differs."
    },
    {
      "attack": "Human reviewers can infer and favor the full arm.",
      "response": "Deterministic checks run first and reviewers use preregistered rubrics while blinded to arm assignment."
    },
    {
      "attack": "Strict gates may retain tests that merely encode the expected output.",
      "response": "Held-out changed transfer tasks and Rung 5 mutations test routing and falsification rather than example copying."
    },
    {
      "attack": "A fault simulator does not prove production reliability.",
      "response": "Rung 8 supports only the declared distributed-safety fixtures; performance, migration, canary, and production claims remain out of scope."
    }
  ],
  "selection": "CAN-matched-clean-session-evaluation",
  "next_evidence_requests": []
}
```
