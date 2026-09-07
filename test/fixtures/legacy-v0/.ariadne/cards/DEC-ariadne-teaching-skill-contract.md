# DEC-ariadne-teaching-skill-contract: Teach Ariadne with one progressively routed worked example

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

The Ariadne Teaching Skill is a thin task-first pedagogy layer: it sends a fresh agent through one complete progressively routed parser decision, then self-explanation, one faded case, one changed transfer case, and one runnable check; it links Ariadne rules and Method Contract IDs without copying either source.

## Payload

```json
{
  "dependencies": [
    "DEC-method-contract-shape",
    "EVD-ariadne-teaching-flow-prototype-r3",
    "VAL-SELECT-ariadne-teaching-skill"
  ],
  "owner": "user approval through the Wayfinder prototype checkpoint",
  "candidate": "CAN-task-first-progressive-teaching",
  "selection": "VAL-SELECT-ariadne-teaching-skill",
  "evidence": [
    "EVD-ariadne-teaching-flow-prototype-r3"
  ],
  "ownership": {
    "teaching_skill": "lesson order, example fixtures, prompts, fading, transfer, and completion guidance",
    "ariadne": "router, operation semantics, graph vocabulary, provenance, gates, and evidence classes",
    "method_contract": "compact normative method truth and stable IDs",
    "prohibition": "The teaching skill may cite paths and IDs but may not reproduce normative rule or contract prose."
  },
  "entry_contract": {
    "trigger": "A fresh agent must learn or apply Ariadne and has not yet demonstrated an independent correct route.",
    "opening": "Present the config-line parser task before terminology or a rule catalog.",
    "required_inputs": [
      "current task and repository facts",
      ".agents/skills/ariadne/SKILL.md",
      "only rule files whose triggers fire",
      "Ariadne CLI or equivalent validated writer"
    ],
    "procedure": [
      "Attempt the meaningful task.",
      "When decision-significant uncertainty appears, open rules/05-uncertainty.md.",
      "Return to Ariadne SKILL.md and open exactly the current operation rule.",
      "Open rules/00-core.md immediately before graph mutation and a cross-cutting rule only when its named concern appears.",
      "Persist cards and links in the isolated example graph.",
      "Run the example assertion check and Ariadne structural, semantic, and epistemic gates.",
      "Answer self-explanation prompts, complete the faded case, and route the changed transfer case."
    ],
    "stop_conditions": [
      "unresolved decision-significant unknown",
      "invalid artifact or graph link",
      "evidence below the required claim-class rung",
      "gate failure",
      "normative prose copied into the teaching layer",
      "completion inferred from narrative confidence"
    ]
  },
  "routing_contract": {
    "always_start": ".agents/skills/ariadne/SKILL.md",
    "uncertainty_preflight": "rules/05-uncertainty.md only when ambiguity or an unknown changes the next action",
    "operation_rule": "Open only the first matching current branch and return to the router when a new branch appears.",
    "cross_cutting": {
      "rules/00-core.md": "before graph or provenance mutation",
      "rules/evidence.md": "when requesting or judging evidence",
      "rules/invalidation.md": "only after falsifying evidence",
      "rules/roles.md": "only when host or owner boundaries are material",
      "rules/depth-modes.md": "only when choosing Fast, Standard, or Deep",
      "rules/agent-rules.md": "only when multi-agent invariants are material"
    },
    "worked_path_loaded": [
      "SKILL.md",
      "05-uncertainty.md",
      "10-frame.md",
      "00-core.md",
      "40-explore.md",
      "80-value.md",
      "90-validate.md",
      "evidence.md"
    ],
    "worked_path_not_loaded": [
      "20-diagnose.md",
      "30-transform.md",
      "50-knowledge.md",
      "60-dependencies.md",
      "70-dynamics.md",
      "invalidation.md",
      "roles.md",
      "depth-modes.md",
      "agent-rules.md"
    ]
  },
  "worked_example": {
    "task": "A request proposes adding a package to parse KEY=VALUE lines. Preserve the existing format, split on the first equals sign, retain further equals signs in the value, reject an empty key or missing delimiter, and add no dependency unless required.",
    "frame": "The parser behavior is required; the package is only a proposed mechanism.",
    "candidates": [
      {
        "id": "CAN-first-delimiter-stdlib",
        "mechanism": "String.indexOf plus slice inside the parser boundary",
        "result": "PASS"
      },
      {
        "id": "CAN-json-input",
        "mechanism": "change the data representation to JSON",
        "result": "FAIL existing input compatibility"
      },
      {
        "id": "CAN-environment-boundary",
        "mechanism": "move ownership to environment variables",
        "result": "FAIL file-input ownership"
      }
    ],
    "selection": "The stdlib candidate is the only eligible mechanism, provisional until evidence.",
    "implementation": "Find the first equals index, reject index less than or equal to zero, and return the two slices.",
    "evidence": "Four deterministic Node assertions cover a normal value, a value containing equals, an empty key, and a missing delimiter. This is Algorithmic logic at Rung 3.",
    "decision": "Lock the stdlib parser only after EVD-config-line-parser-r3 is SUPPORTED.",
    "route": [
      "Uncertainty",
      "Frame",
      "Explore",
      "Value",
      "Validate"
    ]
  },
  "artifact_set": {
    "teaching_package": [
      "SKILL.md",
      "example/README.md",
      "example/solution.mjs",
      "example/check.mjs",
      "example/.ariadne/GRAPH.jsonl",
      "example/.ariadne/INDEX.md",
      "example/.ariadne/STATE.yaml"
    ],
    "example_graph": [
      "FRAME-config-line-parser",
      "SPACE-config-line-parser",
      "CAN-first-delimiter-stdlib",
      "CAN-json-input",
      "CAN-environment-boundary",
      "VAL-SELECT-config-line-parser",
      "EVDREQ-config-line-parser-r3",
      "EVD-config-line-parser-r3",
      "DEC-config-line-parser"
    ],
    "omitted": "No copied router, rule summaries, Method Contract replica, custom schema, course runtime, or new dependency."
  },
  "self_explanation_prompts": [
    "Why is adding a parser package a mechanism rather than a behavioral requirement?",
    "Why are JSON and environment input rejected before preference comparison?",
    "Why can Rung 3 support this algorithmic claim but not distributed safety?",
    "Why were Diagnose, Transform, Knowledge, Dependencies, and Dynamics not loaded?"
  ],
  "fading": {
    "task": "A query-string parser proposal must preserve repeated keys and percent decoding.",
    "provided": [
      "FRAME record",
      "three candidate records",
      "hard requirements"
    ],
    "withheld": [
      "rule route after Frame",
      "constraint filter verdict",
      "evidence request and result",
      "locked decision"
    ],
    "success": "The learner selects native URLSearchParams only after the required behavior, eligible candidates, and matched check support it."
  },
  "transfer": {
    "task": "A service intermittently emits duplicate invoices after timeout and retry.",
    "expected_route": [
      "05 Uncertainty",
      "20 Diagnose",
      "70 Dynamics",
      "90 Validate with matched evidence"
    ],
    "purpose": "The causal and time-dependent shape differs from the worked parser decision, so memorizing Frame to Explore to Value is insufficient."
  },
  "runnable_check": {
    "command": "node example/check.mjs && ariadne gate all --strict",
    "assertions": [
      "A=1 returns key A and value 1",
      "TOKEN=a=b retains a=b as the value",
      "=x throws",
      "NO_DELIMITER throws"
    ],
    "graph_criteria": [
      "all example nodes and edges validate",
      "the EVD result answers the Rung 3 request",
      "the decision references the passing candidate and evidence",
      "no unresolved gate diagnostic remains in the isolated fixture"
    ]
  },
  "completion": {
    "required": [
      "worked assertion check passes",
      "all three Ariadne gates pass in the isolated fixture",
      "four self-explanations are correct",
      "the faded case reaches an evidence-backed decision",
      "the transfer case is routed to Diagnose then Dynamics",
      "no source-ownership violation"
    ],
    "not_proven": [
      "clean-session teaching effectiveness",
      "coverage of every Ariadne operation",
      "real host adapter behavior"
    ]
  },
  "reopen_condition": "Reopen if the live Ariadne router or graph contract makes a path stale, a clean-session learner cannot finish or transfer without oral help, the example check accepts mismatched evidence, or a supported host cannot resolve the referenced sources.",
  "adversarial_critique": [
    "The small parser example trades domain complexity for a complete executable local proof; the changed transfer case checks that the learner uses the router rather than memorizing the route.",
    "Rule access cannot be physically unloaded from an agent context, so the enforceable requirement is no speculative preload, not forgetting already-read sources.",
    "The Rung 3 prototype validates only the lesson state model; ticket 11 owns clean-session effectiveness.",
    "Generated or copied normative prose is prohibited because it would make lesson updates look like method changes and create drift."
  ]
}
```
