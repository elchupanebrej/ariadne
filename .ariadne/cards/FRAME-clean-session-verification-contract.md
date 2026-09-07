# FRAME-clean-session-verification-contract: Bound clean-session verification and evaluation

- Status: AGREED
- Provenance: DECIDED
- Type: FRAME
- Revised: 2026-09-07

## Statement

Evaluate teaching, orchestration, and absence of hidden author context as separate bounded claims using declared inputs, held-out tasks, matched baselines, non-compensatory gates, and evidence matched to each claim class.

## Payload

```json
{
  "dependencies": [
    "DEC-staged-fixed-point-contract",
    "DEC-ariadne-teaching-skill-contract",
    "DEC-methodology-authoring-teaching-skill-contract",
    "DEC-harness-authoring-teaching-skill-contract",
    "DEC-matt-ariadne-adapter-contract",
    "DEC-runtime-safety-recovery-contract"
  ],
  "falsification_conditions": [
    "any full evaluation arm needs undeclared context or oral guidance",
    "any required output passes with an invalid artifact, authority, owner, evidence, or lifecycle state",
    "any advertised combination lacks a reproducible required receipt",
    "a matched thinner baseline passes every hard invariant retained as justification for an added layer"
  ],
  "context": "The Teaching Skills and Orchestration Harness have deterministic design prototypes but no clean-session empirical receipts. Structural self-consistency cannot prove teaching effectiveness or runtime fitness.",
  "required_behavior": "For every advertised host, model, and adapter combination, fresh isolated sessions must independently complete held-out near-transfer and changed-transfer tasks, or safely stop, using only a pinned allowlisted input manifest; the harness must preserve a unique safe disposition through real boundary operations and injected failures.",
  "proposed_mechanism": "A matched clean-session evaluation pack is proposed; author-guided demonstrations and structural self-checks are comparison candidates, not requirements.",
  "preconditions": [
    "Method Contract, guide, Teaching Skill, adapter, workspace, task, and oracle versions and digests are frozen",
    "each evaluation arm receives the same task, host, model, tools, budget, and declared sources",
    "the evaluator can provision a new session or process and an isolated allowlisted workspace view"
  ],
  "postconditions": [
    "each bounded claim has SUPPORTED, FALSIFIED, or INCONCLUSIVE receipts at its minimum evidence rung",
    "every critical artifact and safety assertion has a machine or preregistered reviewer verdict",
    "each added Teaching Skill or neutral kernel has a matched baseline deletion verdict"
  ],
  "invariants": [
    "teaching, orchestration, hidden-context isolation, and structural fixed-point claims remain separate",
    "no undeclared author conversation, memory, file, network response, sibling-run artifact, or oral hint enters a Clean-Session Run",
    "one critical failure cannot be compensated by scores or unrelated passes",
    "claims remain bounded to tested host, model, adapter, task, and version combinations",
    "owner semantics and state remain with the Method Contract, tracker and Matt skills, Ariadne, host, adapters, and humans"
  ],
  "constraints": [
    "reuse existing Method Contract, Teaching Skill checks, Ariadne gates, adapter contracts, and pointer-only receipts",
    "use simulated or disposable effects for fault injection",
    "do not claim throughput, migration safety, production reliability, or universal pedagogy",
    "do not build a new evaluation runtime, test framework, telemetry store, or reviewer workflow"
  ],
  "behavioral_delta": "Current Rung 3 prototypes show deterministic fixture logic; the missing behavior is reproducible independent completion, transfer, real boundary conformance, and safe recovery without hidden author context.",
  "perspectives": {
    "learner": "receives a complete task and declared sources but not the oracle or author assistance",
    "evaluator": "owns provisioning, input-manifest audit, arm assignment, and reproducible receipts",
    "domain_reviewer": "scores only preregistered semantic criteria and remains blind to the evaluation arm",
    "owner": "retains normative or operational authority and issues receipts",
    "maintainer": "can reproduce failures and delete a layer whose matched baseline passes"
  },
  "unknowns": [
    "whether each Teaching Skill outperforms its source-only baseline on held-out transfer tasks",
    "whether every advertised adapter conforms at a real boundary",
    "whether the thin harness baseline satisfies all continuation invariants",
    "whether injected crash and concurrency paths preserve every distributed-safety invariant"
  ],
  "contradictions": [
    "the learner needs realistic source access while evaluation must exclude undeclared author context",
    "agent behavior may vary while critical safety gates cannot be averaged"
  ],
  "success_observer": "independent evaluation operator, deterministic validators, and blinded domain reviewer",
  "owner": "user via confirmed Wayfinder grilling"
}
```
