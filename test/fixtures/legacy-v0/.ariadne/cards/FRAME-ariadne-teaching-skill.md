# FRAME-ariadne-teaching-skill: Teach Ariadne through one progressive task

- Status: ACTIVE
- Provenance: FACT
- Type: FRAME
- Revised: 2026-08-24

## Statement

A fresh agent must learn to route only the current decision-significant branch, persist valid Ariadne artifacts, explain the decision, and verify one complete result without copying the Method Contract or preloading every rule.

## Payload

```json
{
  "falsification_conditions": [
    "A fresh agent cannot select the next rule without extra oral context",
    "The example passes while using mismatched evidence or invalid graph artifacts",
    "The teaching package must copy normative contract fields to function"
  ],
  "context": "The Ariadne teaching skill is a pedagogical entry point for a fresh agent session, not a normative reasoning engine.",
  "required_behavior": "Given one meaningful repository task, the learner selects the matching Ariadne operation as each branch appears, loads only the router and triggered rules, writes linked graph artifacts, runs matched checks and gates, explains the route, completes a faded case, and transfers to a changed case.",
  "proposed_mechanism": "A dedicated Ariadne Teaching Skill with a complete worked example is proposed; its exact teaching shape remains a mechanism.",
  "preconditions": [
    "Ariadne SKILL.md and rule files are resolvable",
    "The Ariadne CLI or equivalent artifact writer is available",
    "The worked example starts in an isolated fixture workspace"
  ],
  "postconditions": [
    "The worked example has valid graph artifacts and a matched evidence receipt",
    "The learner can complete one faded case and route one changed case",
    "No normative Method Contract content or Ariadne rule prose becomes a second source of truth"
  ],
  "invariants": [
    "Ariadne owns epistemic semantics and graph vocabulary",
    "The Method Contract owns compact normative method truth",
    "The teaching layer owns examples, prompts, fading, and completion guidance only",
    "Evidence strength never exceeds the executed check"
  ],
  "constraints": [
    "meaningful task first",
    "one complete worked example",
    "progressive disclosure",
    "self-explanation",
    "fading",
    "transfer",
    "runnable verification",
    "no bulk rule load",
    "no duplicated normative contract"
  ],
  "unknowns": [
    "Clean-session teaching effectiveness remains unmeasured until ticket 11"
  ],
  "success_observer": "A clean-session evaluator observes the agent route, artifacts, explanations, faded attempt, transfer route, and check receipts."
}
```
