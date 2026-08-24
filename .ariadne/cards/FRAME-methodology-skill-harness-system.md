# FRAME-methodology-skill-harness-system: Methodology, skill, and harness system

- Status: OPEN
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-08-24

## Statement

A fresh agent session must be able to learn Ariadne, apply it to a real decision-significant task, produce and validate its artifacts, and reuse the same methodological-guide discipline to create future methodology and harness packages.

## Payload

```json
{
  "falsification_conditions": [
    "A fresh session cannot tell which Ariadne rule to load",
    "The example omits a required artifact or decision branch",
    "The self-application requires circular runtime invocation",
    "The harness guidance cannot generate a second methodology package"
  ],
  "context": "Ariadne is currently a model-invoked skill plus repository CLI and graph artifacts; the requested change spans skill teaching, reusable methodology authoring, harness authoring, and self-application.",
  "required_behavior": "Given only the selected skill instructions and repository artifacts, a fresh agent can choose the correct Ariadne operation, execute a short end-to-end example with every required artifact, distinguish method from harness mechanics, and verify completion without oral context from the author.",
  "proposed_mechanism": "Rewrite the Ariadne skill description and usage, add a methodology-authoring harness skill, add a harness-building skill based on modern harness practice, and build a harness for the methodological-guide methodology; all are proposed mechanisms, not yet locked requirements.",
  "preconditions": [
    "Fresh agent session",
    "A task with decision-significant uncertainty",
    "Repository skill and harness files are readable"
  ],
  "postconditions": [
    "Agent selects and applies the correct Ariadne branch",
    "Worked example demonstrates every required artifact",
    "Reusable authoring skills expose explicit completion and verification criteria",
    "Self-application does not rely on an unexplained runtime cycle"
  ],
  "invariants": [
    "Methodological claims remain traceable to rationale",
    "A worked example does not replace the normative method",
    "Internal self-consistency is not treated as empirical proof",
    "Ariadne remains an epistemic overlay rather than the delivery tracker"
  ],
  "constraints": [
    "Follow docs/designing_methodological_guides.md",
    "Use existing Ariadne rather than inventing a parallel reasoning model",
    "Plan through Wayfinder decision tickets before implementation",
    "Research claims about modern harnesses from primary sources"
  ],
  "behavioral_delta": "The current root Ariadne skill routes operations but does not itself contain the requested short complete worked example or a documented recursive methodology-to-harness authoring system.",
  "perspectives": {
    "fresh_agent": "needs progressive disclosure and one complete example",
    "method_owner": "needs normative ownership and lifecycle",
    "harness_author": "needs reusable construction rules and verification",
    "maintainer": "needs acyclic ownership and explicit change propagation"
  },
  "unknowns": [
    "UNK-wayfinder-destination-boundary",
    "UNK-harness-product-boundary",
    "UNK-recursive-self-application-topology",
    "UNK-modern-agent-harness-practices"
  ],
  "contradictions": [],
  "provenance": {
    "required_behavior": "derived from user request and repository guide",
    "behavioral_delta": "repository inspection"
  },
  "success_observer": "A reviewer can start a clean agent session and falsify the package by checking whether it completes the worked task and emits the declared artifacts without hidden author context."
}
```
