# DEC-clean-session-verification-contract: Matched clean-session verification and evaluation contract

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

Use matched, held-out, manifest-audited Clean-Session Runs with non-compensatory gates: two isolated runs for faded and changed-transfer tasks per tested environment, existing machine checks before blinded review, evidence at Rungs 2, 3, 5, 6, and 8 by claim class, independent safety-boundary fault injection, and mandatory deletion or inlining when a thinner baseline passes.

## Payload

```json
{
  "dependencies": [
    "DEC-staged-fixed-point-contract",
    "DEC-ariadne-teaching-skill-contract",
    "DEC-methodology-authoring-teaching-skill-contract",
    "DEC-harness-authoring-teaching-skill-contract",
    "DEC-matt-ariadne-adapter-contract",
    "DEC-runtime-safety-recovery-contract",
    "VAL-SELECT-clean-session-verification"
  ],
  "owner": "user via confirmed Wayfinder grilling",
  "candidate": "CAN-matched-clean-session-evaluation",
  "selection": "VAL-SELECT-clean-session-verification",
  "claim_separation": {
    "teaching": "independent method routing, artifact completion, recovery, self-explanation, and changed-task transfer",
    "orchestration": "real boundary continuation, waiting, cancellation, replay prevention, artifact gating, and unique safe disposition",
    "hidden_context": "only declared pinned inputs and whitelisted capabilities enter the session",
    "structural": "schema validity and fixed-point self-consistency remain necessary but never substitute for empirical claims"
  },
  "clean_session_contract": {
    "start": "new host session or process with no prior author conversation or model memory",
    "workspace": "isolated view containing only allowlisted pinned inputs and intentionally seeded owner pointers",
    "forbidden": [
      "author oral guidance",
      "undeclared files",
      "sibling-run artifacts",
      "unlisted network responses",
      "oracle content",
      "copied owner or normative state"
    ],
    "manifest_fields": [
      "evaluation and task version and digest",
      "allowed source pointers and digests",
      "skill, Method Contract, guide, adapter, workspace, host, and model pins",
      "tool and network allowlist",
      "budget and run configuration",
      "oracle digest",
      "output locations",
      "session and trace references"
    ],
    "receipt": "capture the manifest, starting workspace inventory, complete tool-access trace, outputs, artifact pointers, and terminal disposition"
  },
  "task_matrix": {
    "teaching_skills": "For each of Ariadne, methodology-authoring, and harness-authoring, run one held-out faded near-transfer task and one structurally changed transfer task twice per tested host, model, and adapter combination.",
    "orchestration_harness": "Run one end-to-end continuation task through the success path and each independent failure injection twice per advertised adapter combination.",
    "oracle": "The learner receives the complete task at invocation; the versioned oracle and arm assignment remain evaluator-only until scoring."
  },
  "baselines": {
    "teaching": "pinned normative sources and task without the Teaching Skill",
    "orchestration": "thin skill-loader plus owner artifacts without a distinct neutral kernel",
    "controls": "task, sources, host, model, tools, budget, pins, and evaluator remain identical across arms"
  },
  "artifact_assertions": [
    "input manifest, pins, initial inventory, and tool trace agree",
    "Method Contract and package schemas, triggered obligations, and completion profiles pass",
    "method route, evidence class and rung, rationale links, outputs, recovery, fading, and transfer match the held-out oracle",
    "owner state remains behind valid pointers and no shadow normative, workflow, epistemic, permission, or human state appears",
    "harness events, cursors, lifecycle transitions, authority, receipts, retries, cancellation, ambiguity, and repository outcomes satisfy their contracts",
    "no circular proof, undeclared input, sibling-run dependency, or oral intervention occurs"
  ],
  "evidence_contract": {
    "rung_2": "schema, compiler, type, and lint claims",
    "rung_3": "deterministic artifact, route, lifecycle-model, and example fixture logic",
    "rung_5": "validator-suite quality with MSI at least 85 percent and every critical mutant killed",
    "rung_6": "bounded clean-session teaching and transfer, real owner-adapter contracts, and comparative kernel deletion",
    "rung_8": "crash, concurrency, replay, cancellation, ambiguous-effect, and recovery safety",
    "excluded": "Rungs 7, 9, and 10 are required only if later claims add performance, migration, or sustained-production behavior"
  },
  "fault_injections": [
    "missing, malformed, corrupt, or owner-mismatched artifact or receipt",
    "source, workspace, Method Contract, capability, adapter, or state pin drift",
    "process reset at cold start, mid-run, approval wait, and after an owner effect but before receipt persistence",
    "missing, denied, expired, broadened, or input-mismatched approval",
    "stale concurrent dispatch intents and duplicate, conflicting, gapped, or regressed events",
    "cancellation racing with committed success and missing owner cancellation acknowledgment",
    "ambiguous committed state and false committed or no-effect receipt",
    "replay without declaration, stable idempotency key, budget, deadline, or resolved ambiguity"
  ],
  "reviewer_contract": {
    "order": "deterministic gates first, human review only for remaining semantic claims",
    "isolation_operator": "independently audits provisioning, input manifest, initial inventory, trace, and absence of undeclared intervention",
    "domain_reviewer": "scores semantic correctness, transfer, recovery, and owner boundaries against a preregistered rubric while blinded to arm",
    "second_review": "required only when a critical criterion has no deterministic oracle",
    "disagreement": "INCONCLUSIVE pending owner adjudication; never average reviewers into a pass"
  },
  "aggregation": {
    "run_verdicts": [
      "SUPPORTED",
      "FALSIFIED",
      "INCONCLUSIVE"
    ],
    "rule": "every critical criterion must pass every required run; no weighted score or unrelated success compensates",
    "missing_or_disputed": "INCONCLUSIVE unless a hard invariant is observably violated, which is FALSIFIED",
    "scope": "report separately by skill, task, environment combination, adapter, injection, and baseline arm"
  },
  "retention_rule": {
    "teaching_skill": "retain only when every full-arm critical gate passes and its matched source-only arm fails at least one intended teaching or transfer criterion",
    "neutral_kernel": "retain only when it passes a hard continuation invariant that every thinner eligible baseline fails",
    "equal_pass": "delete or inline the added layer",
    "variable_result": "mark INCONCLUSIVE and gather more matched runs before retention"
  },
  "required_evidence": [],
  "not_proven": [
    "universal teaching effectiveness",
    "untested host, model, adapter, task, or version behavior",
    "throughput or latency",
    "migration safety",
    "canary safety",
    "sustained production reliability"
  ],
  "adversarial_critique": [
    "The contract bounds claims instead of converting two runs into a universal pedagogy claim.",
    "The held-out oracle stays outside the learner input while the task itself is complete and auditable.",
    "Matched controls isolate the added layer and make deletion a first-class result.",
    "Independent failure injections cover boundaries without a combinatorial fault matrix.",
    "Existing package checks, Ariadne gates, and adapter contracts are reused; no evaluation runtime is specified."
  ],
  "reopen_condition": "Reopen if a supported host cannot provide auditable clean-session isolation, held-out transfer exposes a missing method obligation, mutation testing leaves a critical validator gap, real adapters diverge from their contract, Rung 8 faults violate safety, or repeated INCONCLUSIVE results require a statistical or broader environment design."
}
```
