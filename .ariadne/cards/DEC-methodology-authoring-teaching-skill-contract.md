# DEC-methodology-authoring-teaching-skill-contract: Teach methodology authoring with one pinned vertical slice

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

The Methodology Authoring Teaching Skill is a thin task-first pedagogy layer: it pins one Method Contract, authors a complete dependency-change review guide through A0 and justified A1-A7 expansions, repairs a failed rationale obligation, records external receipts, then uses self-explanation, a faded case, and a metamethodological transfer without copying or recursively invoking the method.

## Payload

```json
{
  "dependencies": [
    "DEC-method-contract-shape",
    "DEC-staged-fixed-point-contract",
    "EVD-methodology-authoring-teaching-flow-prototype-r3",
    "VAL-SELECT-methodology-authoring-teaching-skill"
  ],
  "owner": "user-directed Wayfinder resolution",
  "candidate": "CAN-task-first-method-vertical-slice",
  "selection": "VAL-SELECT-methodology-authoring-teaching-skill",
  "evidence": [
    "EVD-methodology-authoring-teaching-flow-prototype-r3"
  ],
  "ownership": {
    "teaching_skill": "lesson order, example inputs and solution, prompts, fading, recovery exercise, transfer, and completion guidance",
    "method_contract": "normative artifact schemas, rules, effects, completion profiles, verification hooks, and lifecycle metadata",
    "long_guide": "definitions, rationale, evidence synthesis, provenance, and explanatory text",
    "orchestration_harness": "pin checks, generic schema and obligation evaluation, owner receipt pointers, stops, and attempt state",
    "prohibition": "The teaching skill cites pinned contract IDs and live guide anchors but never copies normative contract or rationale prose."
  },
  "entry_contract": {
    "trigger": "A fresh session must author or revise a methodological guide and has not demonstrated independent contract-driven completion.",
    "required_inputs": [
      "meaningful guide-authoring task and repository facts",
      "bootstrap.lock pointers for G_n and M_n with versions and byte digests",
      "the target completion profile",
      "owner and host adapter capability pointers"
    ],
    "procedure": [
      "Present the real authoring task before A0-A7 terminology.",
      "Load and validate the single pinned Method Contract; fail closed on unsupported format, schema dialect, or digest.",
      "Select the smallest completion profile justified by the target; the worked example uses evidence-focused.",
      "Draft A0 with known, assumed, and unknown statements and run its schema and triggered obligations.",
      "Expand an A1-A7 artifact only when the contract signal appears, recording the signal in A0 and retaining a concise pointer there.",
      "Resolve each material rule through its rationale_ref to the pinned long-guide anchor and record the case-specific rationale-to-recommendation inference.",
      "Run artifact, traceability, completion, pin, owner-receipt, and no-circular-validation checks.",
      "Practice one targeted recovery, then answer self-explanations, complete the faded case, and route the changed metamethodological transfer."
    ],
    "stop_conditions": [
      "unsupported or mismatched contract or guide pin",
      "malformed artifact or ambiguous effect",
      "unresolved rationale, owner, human, approval, artifact, or receipt obligation",
      "self-consistency offered as external evidence",
      "normative delta or assessor disagreement during self-application",
      "teaching package contains copied normative content"
    ]
  },
  "worked_example": {
    "task": "Author an evidence-focused guide for a first-time repository maintainer who must approve, request changes on, or escalate a dependency-change pull request and leave a verifiable review record.",
    "A0": "Names the novice reviewer and dependency-change situation; observable decision record; worked, faded, and transfer tasks; expert and target-user verification; rationale pointers and unknowns; and all seven observed expansion signals.",
    "A1": "Defines inconsistent dependency review as the observable problem, a traceable safe decision as the outcome, direct dependency pull requests as scope, unsafe approval as the primary failure, measurable independent performance, and local policy assumptions.",
    "A2": "Records procedural and conditional claims for manifest and lockfile consistency, repository checks, security advisories, and license escalation with K type, E class, provenance, confidence, counterconditions, inference, and live rationale_ref.",
    "A3": "Separates novice reviewer, maintainer, security, legal, and guide-owner roles, authority, prior knowledge, context, constraints, accessibility, and participation.",
    "A4": "Defines one dependency-review rule with manifest and lockfile inputs; inspect, verify, branch, decide, and record actions; approve, request-changes, and escalate outputs; recovery from failed checks; and security or license escalation.",
    "A5": "Provides the synthetic dependency pull request, complete worked decision, rationale prompts, a partially supplied incident-handoff guide, independent review task, and a metamethodological transfer.",
    "A6": "Defines expert review, novice task execution, changed-fixture transfer, a repository pilot, observable success and failure criteria, and owner-issued external receipts; self-consistency is absent because the target guide is not a metamethodology.",
    "A7": "Names owner and decision rights, version and digest, policy and advisory review triggers, feedback, deviations, distribution, compatibility, change history, and retirement.",
    "traceability": [
      "RULE-review-dependency-change -> CLAIM-verify-repository -> A5 worked review -> VERIFY-independent-review -> version",
      "RULE-escalate-security -> CLAIM-advisory-check -> A5 error case -> VERIFY-transfer-review -> version",
      "RULE-escalate-license -> CLAIM-license-boundary -> A5 transfer -> VERIFY-pilot -> version"
    ]
  },
  "artifact_set": {
    "files": [
      "SKILL.md",
      "example/README.md",
      "example/input/dependency-change.json",
      "example/solution/guide-project.json",
      "example/receipts/external-verification.json",
      "example/check.mjs"
    ],
    "guide_project": "One example bundle contains A0, A1-A7, traceability, completion profile, and source pins; generated per-artifact views are optional and non-normative.",
    "omitted": "No copied Method Contract, embedded long-guide rationale, template generator, course runtime, database, or new dependency."
  },
  "recovery_contract": [
    {
      "failure": "contract or guide pin mismatch",
      "response": "stop, reload the exact owner-approved pin, discard mixed derived views, and restart the attempt"
    },
    {
      "failure": "artifact schema or triggered obligation failure",
      "response": "repair only the named artifact, preserve the failure receipt, and rerun artifact.changed plus affected completion checks"
    },
    {
      "failure": "unresolved rationale_ref",
      "response": "stop; resolve an owner-approved anchor under the same guide pin and rerun link resolution; never infer substitute prose"
    },
    {
      "failure": "missing human, approval, or owner receipt",
      "response": "remain waiting with the pending-action pointer; never synthesize the receipt"
    },
    {
      "failure": "self-application delta or assessor disagreement",
      "response": "stop for Method Contract owner review and, if accepted, start a new immutable bootstrap round; never loop or rewrite active inputs"
    },
    {
      "failure": "ambiguous effect or unsupported format",
      "response": "fail closed and hand the incompatibility to the Method Contract owner"
    }
  ],
  "learning_contract": {
    "self_explanation": [
      "Why did each A1-A7 expansion fire instead of being created mechanically?",
      "Why must A0 remain concise after expansion?",
      "Why does a rationale citation need a case-specific inference?",
      "Why can self-consistency not satisfy external user verification?",
      "Why does targeted recovery rerun affected hooks instead of rebuilding the method?"
    ],
    "faded_case": "Provide an incident-handoff guide task, A0, contract pin, and expansion signals; withhold A2, A4, A6, A7, trace decisions, owner receipts, and the completion verdict.",
    "transfer": "For a guide-authoring methodology, the learner selects the metamethodological profile, two isolated immutable assessment bundles, normalized P/A/R/L comparison, and separate external receipts; the active skill never invokes or rewrites itself."
  },
  "verification_contract": {
    "command": "node example/check.mjs",
    "required": [
      "the example bundle matches the pinned Method Contract envelope and evidence-focused profile",
      "A0 and every A1-A7 artifact validate and every expansion cites its trigger",
      "all triggered effects and stops are resolved",
      "all rationale_ref values resolve under the pinned guide digest",
      "traceability reaches a verification receipt and lifecycle version for every material rule",
      "external owner receipts exist and no self-consistency receipt substitutes for them",
      "the recovery exercise preserves the failure receipt and passes targeted reruns",
      "self-explanations, faded case, and metamethodological transfer meet their rubrics",
      "no shadow normative source exists"
    ],
    "rung_limit": "The deterministic teaching-flow prototype is Rung 3 Algorithmic logic only; ticket 11 owns clean-session completion, transfer, and cross-host evidence."
  },
  "reopen_condition": "Reopen if the live Method Contract cannot express a required artifact or recovery without arbitrary computation, a clean-session learner needs oral guidance, source pointers cannot resolve on a supported host, the example accepts a circular proof or pin drift, or the self-application route introduces a runtime cycle.",
  "adversarial_critique": [
    "The complete example expands all A1-A7 only because the chosen organization-normative scenario supplies every contract signal; ordinary learners still begin with A0 and expand selectively.",
    "One JSON example bundle minimizes files while preserving separately addressable stable IDs and schema validation.",
    "The Rung 3 prototype validates only completion logic; it does not establish pedagogical effectiveness.",
    "Immutable self-application receipts preserve the fixed-point requirement without recursive execution."
  ]
}
```
