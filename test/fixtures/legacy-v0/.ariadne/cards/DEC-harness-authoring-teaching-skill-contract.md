# DEC-harness-authoring-teaching-skill-contract: Teach harness authoring with one failure-driven vertical slice

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

The Harness Authoring Teaching Skill is a thin failure-driven pedagogy layer: it pins the method and current research, defines repository outcomes, tests the thin baseline, places owner boundaries, adds only failed-invariant mechanisms, completes and recovers one orchestration example, then fades and transfers through the acyclic bootstrap.

## Payload

```json
{
  "dependencies": [
    "DEC-minimum-orchestration-contract",
    "DEC-method-contract-shape",
    "DEC-staged-fixed-point-contract",
    "DEP-harness-authoring-bootstrap-boundary",
    "EVD-harness-authoring-teaching-flow-prototype-r3",
    "VAL-SELECT-harness-authoring-teaching-skill"
  ],
  "owner": "user-directed Wayfinder resolution",
  "candidate": "CAN-failure-driven-harness-vertical-slice",
  "selection": "VAL-SELECT-harness-authoring-teaching-skill",
  "evidence": [
    "EVD-modern-agent-harness-practices",
    "EVD-harness-authoring-teaching-flow-prototype-r3"
  ],
  "ownership": {
    "teaching_skill": "lesson order, task and failure fixtures, source-routing prompts, recovery practice, fading, transfer, and completion guidance",
    "method_contract": "normative method schemas, rules, effects, completion profiles, verification hooks, and lifecycle metadata",
    "harness_research": "current external practice, provenance, limitations, and falsifiers",
    "orchestration_contract": "host-neutral responsibility and state boundary",
    "orchestration_harness": "attempt pointers, generic artifact and receipt gates, pending actions, pins, and lifecycle correlation",
    "other_owners": "host owns model, tools, sandbox, approvals, and native traces; Ariadne owns epistemic state; tracker and Matt skills own work semantics",
    "prohibition": "The lesson and harness cite pinned sources and owner receipts but never copy their mutable or normative state."
  },
  "entry_contract": {
    "trigger": "A fresh session must design, revise, or evaluate an agent harness whose context, routing, continuation, artifacts, approvals, recovery, evaluation, observability, security, or lifecycle behavior is decision-significant.",
    "required_inputs": [
      "one meaningful harness task and repository-observable success and failure outcomes",
      "bootstrap.lock pointers for G_n, M_n, MA_n, and the harness research snapshot with versions and digests",
      "workspace revision and owner map",
      "host capability and adapter contract pointers",
      "thin baseline fixture"
    ],
    "procedure": [
      "Present the lifecycle task before naming harness components.",
      "Pin and validate every normative, research, workspace, and host-capability input.",
      "Write outcome fixtures and stop conditions before choosing a mechanism.",
      "Place each datum and enforcement responsibility with the method, tracker, Ariadne, host, or harness owner.",
      "Run the thin baseline and retain a new boundary only for failed hard invariants.",
      "Evaluate the thin baseline, host-specific plugin, and neutral kernel through a non-compensatory requirement filter.",
      "Add only mechanisms whose observable trigger fired; keep owner payloads behind pointers.",
      "Run lifecycle, recovery, artifact, pin, approval, replay, adapter, and trace checks.",
      "Practice one targeted recovery, answer self-explanations, complete a faded case, and route the staged self-application transfer."
    ],
    "stop_conditions": [
      "unsupported or mismatched source, contract, workspace, adapter, or host capability pin",
      "ambiguous owner or copied owner state",
      "invalid artifact, receipt, pending action, or lifecycle transition",
      "human or approval requirement without an owner-issued decision",
      "ambiguous side effect without replay declaration or inspection receipt",
      "candidate choice without the thin baseline and hard-requirement filter",
      "live invocation or rewriting of the active builder",
      "self-consistency offered as empirical effectiveness evidence"
    ]
  },
  "trigger_set": [
    {
      "when": "ordered context must survive a fresh process",
      "add": "content-addressed context manifest of resolvable pointers"
    },
    {
      "when": "one attempt must pause, resume, cancel, or correlate retries",
      "add": "repository-visible run ID, opaque step, lifecycle status, attempt, event cursor, and owner references"
    },
    {
      "when": "advancement depends on machine-checkable output",
      "add": "closed artifact envelope and owner receipt gate"
    },
    {
      "when": "host invocation, resume, approvals, sandbox, or traces vary",
      "add": "capability-negotiated host adapter that stores native object references"
    },
    {
      "when": "human input or permission is pending",
      "add": "waiting state and pending-action pointer; host retains enforcement"
    },
    {
      "when": "an effect may be replayed",
      "add": "idempotency key, deadline, owner replay declaration, and inspection stop for ambiguity"
    },
    {
      "when": "failure diagnosis or cross-host comparison requires correlation",
      "add": "normalized lifecycle events and trace IDs; sensitive payload capture remains opt-in"
    },
    {
      "when": "method, skill, adapter, workspace, or state versions can drift",
      "add": "version and digest pins with fail-closed load and resume"
    },
    {
      "when": "concurrent writers or remote coordination are measured requirements",
      "add": "the smallest storage or coordination mechanism that passes their contract",
      "default": "atomic repository files and one writer; no database, queue, scheduler, or service"
    }
  ],
  "worked_example": {
    "task": "Design the smallest host-neutral harness that executes the dependency-change review method across fresh sessions, preserves a security approval wait, and does not duplicate a review publication after process loss.",
    "required_outcomes": [
      "a new process identifies exactly one valid next action from repository-visible state",
      "human, approval, invalid-artifact, pin-mismatch, and ambiguous-effect boundaries stop safely",
      "no non-replay-safe effect is automatically duplicated",
      "owner semantics and state remain behind pointers",
      "normalized events correlate every run, attempt, step, and host trace"
    ],
    "owner_map": {
      "method": "review rules and completion predicates",
      "tracker": "pull-request work status and conversation",
      "ariadne": "claims, evidence, uncertainty, and invalidation",
      "host": "model and tool loop, sandbox, permissions, and native session or trace objects",
      "harness": "attempt cursor, pins, ordered pointers, generic gates, pending-action references, and normalized lifecycle events"
    },
    "candidate_result": {
      "thin_baseline": "fails mid-run reset and ambiguous-effect resolution without hidden human memory",
      "host_plugin": "fails the stated host-neutral behavior requirement but remains a future eligible adapter or single-host fallback",
      "neutral_kernel": "passes statically with the minimum contract and remains subject to the ticket 11 deletion test"
    },
    "state_model": "created -> running -> waiting -> running -> succeeded, failed, or canceled; timeout, stall, and error remain attempt reasons rather than new top-level states",
    "run_record": [
      "run_id",
      "opaque step_ref",
      "status",
      "attempt",
      "Method Contract, skill, adapter, workspace, and input pins",
      "idempotency key and deadline",
      "event cursor",
      "owner receipt, artifact, and pending-action pointers"
    ],
    "context_manifest": "ordered content-addressed pointers with media type, role, version, digest, and owner; no canonical mega-prompt",
    "artifact_envelope": "schema version, artifact ID and kind, producer run/step/attempt, pinned input pointers, output pointer and digest, owner receipt pointers, status, and completion predicate result",
    "adapter": [
      "capabilities",
      "start",
      "resume",
      "cancel",
      "events"
    ],
    "walkthrough": [
      "cold start loads pins and pointers, then enters running",
      "security evidence requires a host-enforced approval and repository-visible waiting pointer",
      "a fresh process resumes the same pending action without synthesizing approval",
      "publication loses its process before receipt and remains waiting as ambiguous",
      "owner inspection attaches the existing publication receipt; no replay occurs",
      "artifact and completion gates pass and the run succeeds"
    ],
    "evaluation": [
      "cold start",
      "mid-run reset",
      "approval reset",
      "crash after side effect",
      "corrupt artifact",
      "method upgrade or pin drift",
      "fake and production adapter conformance"
    ],
    "verdict": "retain the minimal kernel provisionally because the full worked baseline fails hard continuation and replay invariants; delete or inline it if ticket 11 shows the thin baseline satisfies them"
  },
  "artifact_set": {
    "files": [
      "SKILL.md",
      "references/harness-research.md",
      "example/README.md",
      "example/input/dependency-review-run.json",
      "example/solution/harness-project.json",
      "example/check.mjs"
    ],
    "harness_project": "One example bundle contains pins, outcome requirements, ownership map, trigger decisions, candidate filter, context and run records, artifact envelopes, adapter boundary, recovery policy, lifecycle events, evaluation fixtures, lifecycle decision, and staged self-application pointers.",
    "omitted": "No runtime scaffold, copied Method Contract, copied Ariadne or tracker state, framework tutorial, database, queue, scheduler, migration framework, plugin marketplace, or new dependency."
  },
  "recovery_contract": [
    {
      "failure": "source, workspace, or capability pin mismatch",
      "response": "stop, load the exact owner-approved pins, discard mixed derived views, and restart or open a new compatible attempt"
    },
    {
      "failure": "artifact or owner receipt invalid",
      "response": "preserve the failure, repair only the named owner artifact, and rerun the affected gate"
    },
    {
      "failure": "human or approval pending",
      "response": "remain waiting with a resolvable pending-action pointer; never synthesize or bypass the decision"
    },
    {
      "failure": "effect completion ambiguous",
      "response": "stop automatic retries, preserve the idempotency and host correlation references, obtain an owner inspection receipt, then resume or compensate through the owner"
    },
    {
      "failure": "unsupported state or adapter capability",
      "response": "fail closed and hand the incompatibility to the state or adapter owner"
    },
    {
      "failure": "normative delta or assessor disagreement",
      "response": "stop the immutable round for Method Contract owner review; accepted change starts b_(n+1) and rebuilds affected consumers"
    }
  ],
  "learning_contract": {
    "self_explanation": [
      "Which observed failure justified every retained harness mechanism?",
      "Why does the harness store owner pointers instead of method, tracker, Ariadne, or host payloads?",
      "Why can a passing thin baseline eliminate the kernel?",
      "Why does an ambiguous effect stop instead of retry?",
      "Why do normalized events default to metadata rather than raw prompts and tool payloads?",
      "Why is HA_n absent from the OH_n runtime graph?"
    ],
    "faded_case": "Provide an issue-triage continuation task, pins, outcome fixtures, and research pointers; withhold the owner map, candidate verdict, mechanism triggers, recovery policy, lifecycle decision, and completion verdict.",
    "transfer": "For the method self-application target, the learner routes HA_n to specify OH_n and OH_n to coordinate two isolated applications of M_n under one immutable lock; HA_n is a build-time input, not a runtime callback."
  },
  "staged_self_application": [
    "MA_n authors HA_n from pinned G_n, M_n, and the harness research snapshot.",
    "HA_n demonstrates its method by producing the complete OH_n design example and passing its structural teaching check.",
    "HA_n specifies OH_n from M_n and owner adapter contracts; neither component invokes or rewrites its active builder.",
    "OH_n coordinates isolated S_n^A and S_n^B applications of M_n to itself.",
    "Every delta stops for owner review and can enter only a new immutable round; empirical receipts remain separate."
  ],
  "verification_contract": {
    "command": "node example/check.mjs",
    "required": [
      "all source, workspace, and host capability pins match",
      "every retained mechanism names an observed trigger and owner",
      "the thin baseline and all structurally eligible candidates receive non-compensatory pass or fail results",
      "run, context, artifact, receipt, pending-action, adapter, and event records satisfy the pointer-only contract",
      "invalid artifacts, approvals, ambiguous effects, replay, and pin drift fail closed",
      "recovery preserves failure and owner inspection receipts and does not duplicate an effect",
      "repository outcomes and normalized events match every lifecycle fixture",
      "the thin-baseline path completes without kernel artifacts when it passes",
      "self-explanations, faded case, and staged transfer meet their rubrics",
      "no copied owner state, shadow Method Contract, or runtime recursion exists"
    ],
    "rung_limit": "The deterministic teaching-flow prototype is Rung 3 algorithmic logic only; tickets 09-11 own real adapters, recovery, contract integration, clean-session completion, transfer, and cross-host evidence."
  },
  "lifecycle": {
    "owner": "teaching-skill owner maintains lesson order and fixtures; source owners approve their normative content and adapter contracts",
    "pins": "every active package and derived example records source version, digest, workspace revision, adapter version, and predecessor",
    "review_triggers": [
      "source research or provider contract changes",
      "Method Contract or orchestration boundary changes",
      "new host capability or lost capability",
      "new failure class, repeated learner error, or failed transfer",
      "measured need for concurrency, remote coordination, or new state version"
    ],
    "feedback": "record fixture, host, source pins, observed decision, failure, and owner disposition",
    "compatibility": "reject unknown state or contract versions; add migration only when a second real version requires it",
    "retirement": "generated views carry source digests; retire or explicitly migrate incompatible predecessors",
    "deletion_rule": "inline or delete the kernel when the thin baseline or host-native boundary passes every hard invariant without hidden state or human memory"
  },
  "reopen_condition": "Reopen if a required harness responsibility lacks a single owner, a clean-session learner needs oral guidance, current source pointers or supported hosts cannot resolve the artifact contract, the example accepts replay, pin drift, copied owner state, or runtime recursion, or the thin baseline passes the full ticket 11 invariants.",
  "adversarial_critique": [
    "The complete example retains a kernel only because its measured baseline fails two hard invariants; the same gate accepts and trims a single-session baseline.",
    "One JSON example bundle minimizes files while keeping records separately addressable by stable ID.",
    "The Rung 3 prototype validates only selection and completion logic, not pedagogy, host compatibility, or recovery under real faults.",
    "Immutable build and assessment stages demonstrate self-construction without mutual runtime recursion.",
    "Research remains a pinned source with review triggers rather than copied universal truth."
  ]
}
```
