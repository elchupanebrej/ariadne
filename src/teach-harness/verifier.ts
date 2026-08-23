import type {
  HarnessArtifactContract,
  HarnessCandidateSelection,
  HarnessDeclaredInputManifest,
  HarnessLifecycleRecord,
  HarnessOutcomeRequirements,
  HarnessOwnershipMap,
  HarnessProject,
  HarnessRecoveryPolicy,
  HarnessTriggerDecision,
  HarnessVerificationResult,
} from "./types.js";

export function createDefaultHarnessDeclaredManifest(): HarnessDeclaredInputManifest {
  return {
    taskId: "dependency-review-continuation-harness",
    taskDescription:
      "Design the smallest host-neutral harness that executes the dependency-change review method across fresh sessions, preserves a security approval wait, and does not duplicate a review publication after process loss.",
    declaredInputs: [
      {
        id: "guide-source-pinned",
        role: "normative-guide",
        source: "docs/designing_methodological_guides.md",
        digest: "sha256:designing-methodological-guides-v1",
        version: "1.0.0",
      },
      {
        id: "method-contract-pinned",
        role: "method-contract",
        source: "methodological-guide-authoring@1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        version: "1.0.0-draft",
      },
      {
        id: "methodology-authoring-pinned",
        role: "authoring-skill",
        source: ".agents/skills/teach-methodology/SKILL.md",
        digest: "sha256:teach-methodology-skill-v1",
        version: "1.0.0",
      },
      {
        id: "harness-research-pinned",
        role: "harness-research",
        source: "references/harness-research.md",
        digest: "sha256:harness-research-reference-v1",
        version: "2026.1",
      },
      {
        id: "workspace-revision-pinned",
        role: "workspace",
        source: "git:rev-parse:HEAD",
        version: "workspace-v1",
      },
      {
        id: "host-capability-pinned",
        role: "host-capability",
        source: "host-capabilities@1.0.0",
        version: "1.0.0",
      },
    ],
  };
}

export const KERNEL_TRIGGERED_MECHANISMS: HarnessTriggerDecision[] = [
  {
    observable_condition: "Ordered context must survive a fresh process",
    smallest_mechanism_added: "content-addressed context manifest",
    trigger_observed: true,
    necessity_criterion: "Process loss requires fresh session to reload exact context without opaque prompt assembly",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "An attempt must pause, resume, cancel, or correlate retries",
    smallest_mechanism_added: "repository-visible attempt cursor",
    trigger_observed: true,
    necessity_criterion: "Cross-session continuation requires repository-visible run_id, step, status, and event cursor",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Advancement depends on machine-checkable output",
    smallest_mechanism_added: "closed artifact and receipt gates",
    trigger_observed: true,
    necessity_criterion: "Owner verification receipts must be checkable by gates before advancing steps",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Invocation, resume, approvals, sandbox, or traces differ by host",
    smallest_mechanism_added: "host capability adapter",
    trigger_observed: true,
    necessity_criterion: "Different host environments require standard capability negotiation and pointer passing",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Human input or permission is pending",
    smallest_mechanism_added: "pending approval pointer",
    trigger_observed: true,
    necessity_criterion: "Security approval requires waiting state with pending-action pointer without synthesized authority",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "An effect may replay after process loss",
    smallest_mechanism_added: "idempotency and replay declaration",
    trigger_observed: true,
    necessity_criterion: "Crash after publication must stop retries and await owner inspection receipt instead of duplicate replay",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Diagnosis or cross-host comparison needs correlation",
    smallest_mechanism_added: "normalized lifecycle and trace correlation",
    trigger_observed: true,
    necessity_criterion: "Normalized lifecycle events must carry run, attempt, step, and host trace correlation",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Method, skill, adapter, workspace, or state versions may drift",
    smallest_mechanism_added: "version and digest pin gate",
    trigger_observed: true,
    necessity_criterion: "State loads must fail closed if source pins or digests do not match exactly",
    owner: "orchestration_harness",
  },
];

export function createDefaultOwnershipMap(): HarnessOwnershipMap {
  return {
    method: {
      owner: "method",
      retained_responsibilities: [
        "Review rules, obligations, stops, and completion predicates",
        "Domain evaluation logic and recommendation criteria",
      ],
      prohibited_responsibilities: [
        "Direct model loop orchestration",
        "Process lifecycle state tracking",
      ],
      state_boundary: "Pinned Method Contract and rules",
    },
    tracker: {
      owner: "tracker",
      retained_responsibilities: [
        "Pull-request work state and issue lifecycle",
        "User review thread and comment records",
      ],
      prohibited_responsibilities: [
        "Epistemic uncertainty modeling",
        "Harness attempt cursor storage",
      ],
      state_boundary: "Issue tracker and repository review metadata",
    },
    ariadne: {
      owner: "ariadne",
      retained_responsibilities: [
        "Epistemic claims, evidence, uncertainty, and decision nodes",
        "Weakest-precondition derivation and transitive invalidation cascade",
      ],
      prohibited_responsibilities: [
        "Pull request work tracking",
        "Host sandbox management",
      ],
      state_boundary: "Epistemic graph .ariadne/ storage",
    },
    host: {
      owner: "host",
      retained_responsibilities: [
        "Model and tool execution loop",
        "Sandbox execution and local permissions",
        "Native session management and raw trace objects",
        "Human approval enforcement",
      ],
      prohibited_responsibilities: [
        "Authoritative review rules",
        "Cross-host run persistence",
      ],
      state_boundary: "Host runtime and native tool/session environment",
    },
    orchestration_harness: {
      owner: "orchestration_harness",
      retained_responsibilities: [
        "Repository-visible attempt cursor and run lifecycle",
        "Source, skill, adapter, and workspace pin validation",
        "Ordered content-addressed context manifest pointers",
        "Generic artifact and owner-receipt gates",
        "Pending-action references and waiting state",
        "Normalized lifecycle events and host trace correlation",
      ],
      prohibited_responsibilities: [
        "Synthesizing human or security approval",
        "Copying or duplicating Ariadne, tracker, or host state payloads",
        "Authoring or interpreting method rules",
        "Automatically replaying ambiguous side effects without inspection receipts",
      ],
      state_boundary: "Pointer-only run ledger, context manifest, and event records",
    },
  };
}

export function createDefaultOutcomeRequirements(): HarnessOutcomeRequirements {
  return {
    success_outcomes: [
      "A new process identifies exactly one valid next action from repository-visible state",
      "Valid artifact envelopes, matching source pins, and owner verification receipts advance the attempt to succeeded",
      "A recovered ambiguous effect attaches an owner inspection receipt and completes without duplicate publication",
    ],
    failure_outcomes: [
      "Missing or mismatching source/workspace/capability pins fail closed on attempt startup",
      "Corrupt or schema-invalid artifact envelopes fail artifact gates with repairable pointers",
      "Unsupported host adapter capability halts attempt and signals owner incompatibility",
    ],
    waiting_outcomes: [
      "Pending human or security approval transitions attempt to waiting with a resolvable pending-action pointer",
      "Process loss after an external side effect leaves the attempt waiting with an ambiguous-effect pointer",
    ],
    stop_outcomes: [
      "Attempt execution halts immediately upon ambiguous side effect without automatic replay",
      "Attempt execution halts when normative contract delta is detected during an immutable round",
    ],
    observable_fixtures: [
      {
        name: "cold_start_fixture",
        trigger: "Fresh CLI process initializes from repository pins",
        expected_outcome: "Attempt created in running state with validated pins",
        observable_receipt: "RECEIPT-cold-start-init",
      },
      {
        name: "mid_run_reset_fixture",
        trigger: "Process termination between review execution and gate evaluation",
        expected_outcome: "Subsequent process reloads context manifest and resumes at exact step_ref",
        observable_receipt: "RECEIPT-mid-run-resume",
      },
      {
        name: "approval_wait_fixture",
        trigger: "Security boundary triggers human approval requirement",
        expected_outcome: "Attempt enters waiting state with pending-action pointer; does not synthesize approval",
        observable_receipt: "RECEIPT-approval-waiting",
      },
      {
        name: "ambiguous_effect_fixture",
        trigger: "Process termination immediately after pull request publication before receipt write",
        expected_outcome: "Attempt enters waiting state; owner inspects remote PR and attaches receipt; no duplicate PR created",
        observable_receipt: "RECEIPT-ambiguous-effect-recovery",
      },
      {
        name: "pin_drift_rejection_fixture",
        trigger: "Method Contract digest modified during active attempt",
        expected_outcome: "Attempt fails closed with pin mismatch error",
        observable_receipt: "RECEIPT-pin-mismatch-rejected",
      },
    ],
  };
}

export function createDefaultRecoveryPolicy(): HarnessRecoveryPolicy {
  return {
    pin_mismatch: {
      action: "stop",
      resolution: "Stop immediately; load exact owner-approved source pins and restart or open compatible attempt",
    },
    invalid_artifact_or_receipt: {
      action: "stop_and_repair_named_owner_artifact",
      resolution: "Preserve failure, repair only named owner artifact, and rerun affected gate without restarting unrelated work",
    },
    human_or_approval_pending: {
      action: "remain_waiting_with_resolvable_pointer",
      resolution: "Remain in waiting status with resolvable pointer; never synthesize or bypass human/security decision",
    },
    ambiguous_side_effect: {
      action: "stop_retries_and_await_owner_inspection_receipt",
      resolution: "Stop automatic retries, preserve idempotency and correlation references, obtain owner inspection receipt, and resume or compensate through owner",
    },
    unsupported_capability: {
      action: "fail_closed",
      resolution: "Fail closed, record capability deficit, and hand incompatibility to host owner",
    },
    normative_delta: {
      action: "stop_immutable_round",
      resolution: "Stop immutable round; accepted changes start a new round and rebuild downstream consumers",
    },
  };
}

export function createDefaultLifecycleRecord(): HarnessLifecycleRecord {
  return {
    ownership: "Harness Teaching Skill Owner (lesson and fixtures) & Source Owners (normative content and adapters)",
    version: "1.0.0",
    source_pins: {
      method_contract: "methodological-guide-authoring@1.0.0-draft (sha256:methodological-guide-authoring-v1)",
      harness_research: "references/harness-research.md@2026.1 (sha256:harness-research-reference-v1)",
      workspace_revision: "workspace-v1",
      host_adapter: "host-capabilities@1.0.0",
    },
    review_triggers: [
      "Method Contract or boundary changes",
      "Host capability or provider changes",
      "Observed continuation failure not covered by existing triggers",
      "Repeated learner failure or failed transfer",
      "Measured requirement for concurrency or remote coordination",
    ],
    feedback_and_deviations: "No deviations from pointer-only single-ownership contract permitted in active round",
    kernel_deletion_rule:
      "Inline or delete the orchestration kernel when a thinner boundary (e.g. skill-loader-plus-owner-artifacts) satisfies all required lifecycle invariants without hidden state or human memory",
    retirement_criteria: [
      "Method Contract superseded by incompatible v2 contract",
      "Native host provides guaranteed cross-session pointer persistence and verification gates",
    ],
  };
}

export function createDefaultCandidateSelection(): HarnessCandidateSelection {
  return {
    evaluations: [
      {
        candidate_name: "thin_baseline",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Cold start loading from repository",
            passed: true,
            reason: "Skill loader successfully loads pinned prompt instructions into host context",
          },
          {
            requirement: "Mid-run reset continuation across processes",
            passed: false,
            reason: "Thin baseline has no repository-visible attempt cursor or event tracking to resume mid-run without hidden memory",
          },
          {
            requirement: "Ambiguous side-effect safe recovery",
            passed: false,
            reason: "Thin baseline cannot detect crash after publication and either loses progress or duplicates publication",
          },
        ],
        verdict_reason: "Fails mid-run continuation and ambiguous effect safety requirements non-compensatorily",
      },
      {
        candidate_name: "host_plugin",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Host-neutral execution across standard environments",
            passed: false,
            reason: "Coupled directly to host proprietary API; fails host-neutral requirement",
          },
          {
            requirement: "Mid-run reset continuation",
            passed: true,
            reason: "Host proprietary session manager can resume on the same host",
          },
        ],
        verdict_reason: "Fails host-neutral portability requirement non-compensatorily",
      },
      {
        candidate_name: "minimal_neutral_kernel",
        status: "provisionally_retained",
        hard_requirements_checked: [
          {
            requirement: "Cold start loading from repository",
            passed: true,
            reason: "Loads pinned sources, workspace, and context manifest via standard adapter",
          },
          {
            requirement: "Mid-run reset continuation across processes",
            passed: true,
            reason: "Repository-visible attempt cursor and opaque step_ref allow unambiguous resume",
          },
          {
            requirement: "Ambiguous side-effect safe recovery",
            passed: true,
            reason: "Enters waiting state upon crash after effect; resumes only with owner inspection receipt",
          },
          {
            requirement: "Host-neutral execution",
            passed: true,
            reason: "Interacts with host via capability-negotiated adapter contract",
          },
        ],
        verdict_reason: "Passes all static hard requirements non-compensatorily; retained provisionally subject to runtime necessity",
      },
    ],
    selected_candidate: "minimal_neutral_kernel",
    selection_rationale:
      "Minimal neutral kernel passes all hard requirements where thin baseline fails continuation and host plugin fails host neutrality",
  };
}

export function createDefaultArtifactContract(): HarnessArtifactContract {
  return {
    context_manifest: [
      {
        pointer_id: "CTX-001-guide",
        media_type: "text/markdown",
        role: "normative-guide",
        version: "1.0.0",
        digest: "sha256:designing-methodological-guides-v1",
        owner: "method",
        target_uri: "file://docs/designing_methodological_guides.md",
      },
      {
        pointer_id: "CTX-002-contract",
        media_type: "application/json",
        role: "method-contract",
        version: "1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        owner: "method",
        target_uri: "method-contract://methodological-guide-authoring/1",
      },
      {
        pointer_id: "CTX-003-input",
        media_type: "application/json",
        role: "input-task",
        version: "1.0.0",
        digest: "sha256:dependency-review-input-v1",
        owner: "tracker",
        target_uri: "file://example/input/dependency-review-run.json",
      },
    ],
    attempt_cursor: {
      run_id: "RUN-dep-review-20260823-001",
      step_ref: "STEP-04-publication-evaluation",
      status: "waiting",
      attempt: 1,
      idempotency_key: "IDEM-dep-review-pr-42-pub",
      deadline: "2026-08-23T14:00:00Z",
      event_cursor: 12,
      pinned_sources: {
        method_contract: "sha256:methodological-guide-authoring-v1",
        skills: ["sha256:teach-methodology-skill-v1"],
        adapter: "host-capabilities@1.0.0",
        workspace: "workspace-v1",
        inputs: "sha256:dependency-review-input-v1",
      },
      owner_receipt_pointers: [
        "RECEIPT-sec-approval-42",
        "RECEIPT-dep-review-verification",
      ],
      artifact_pointers: [
        "ART-dep-review-a0",
        "ART-dep-review-a4-record",
      ],
      pending_action_pointers: [
        "ACTION-owner-inspect-pr-publication-42",
      ],
    },
    artifact_envelopes: [
      {
        schema_version: "methodological-artifact/1",
        artifact_id: "ART-dep-review-a0",
        kind: "A0WorkingMap",
        producing_run_id: "RUN-dep-review-20260823-001",
        producing_step_ref: "STEP-01-working-map",
        producing_attempt: 1,
        pinned_input_pointers: ["CTX-001-guide", "CTX-003-input"],
        output_pointer: "file://artifacts/a0-working-map.json",
        output_digest: "sha256:a0-working-map-digest-v1",
        owner_receipt_pointers: ["RECEIPT-dep-review-init"],
        status: "validated",
        completion_predicate_result: {
          passed: true,
          predicate_id: "PRED-a0-schema-valid",
          evaluated_at: "2026-08-23T12:25:00Z",
        },
      },
      {
        schema_version: "methodological-artifact/1",
        artifact_id: "ART-dep-review-a4-record",
        kind: "A4DecisionMap",
        producing_run_id: "RUN-dep-review-20260823-001",
        producing_step_ref: "STEP-03-decision-rules",
        producing_attempt: 1,
        pinned_input_pointers: ["CTX-002-contract", "ART-dep-review-a0"],
        output_pointer: "file://artifacts/a4-decision-rules.json",
        output_digest: "sha256:a4-decision-rules-digest-v1",
        owner_receipt_pointers: ["RECEIPT-sec-approval-42"],
        status: "validated",
        completion_predicate_result: {
          passed: true,
          predicate_id: "PRED-a4-executable-rules",
          evaluated_at: "2026-08-23T12:27:00Z",
        },
      },
    ],
    host_adapter: {
      adapter_id: "host-adapter-standard-v1",
      capabilities: {
        supported_versions: ["1.0.0", "1.1.0"],
        supports_resume: true,
        supports_native_approvals: true,
        supports_trace_correlation: true,
        sandbox_isolation_level: "process-sandbox",
      },
      interface_methods: {
        capabilities: "capabilities() -> HostCapabilities",
        start: "start(context_manifest, workspace, policy) -> external_run_id",
        resume: "resume(external_run_id, decision_or_input) -> external_run_id",
        cancel: "cancel(external_run_id) -> Result",
        events: "events(external_run_id, cursor) -> NormalizedEvents[]",
      },
    },
    normalized_events: [
      {
        event_id: "EVT-001",
        run_id: "RUN-dep-review-20260823-001",
        attempt: 1,
        step_ref: "STEP-01-working-map",
        timestamp: "2026-08-23T12:24:00Z",
        event_type: "attempt_started",
        host_trace_id: "trace-host-001",
        owner_reference: "orchestration_harness",
        payload_summary: "Validated source pins and loaded context manifest",
      },
      {
        event_id: "EVT-002",
        run_id: "RUN-dep-review-20260823-001",
        attempt: 1,
        step_ref: "STEP-03-security-check",
        timestamp: "2026-08-23T12:26:00Z",
        event_type: "waiting_for_approval",
        host_trace_id: "trace-host-002",
        owner_reference: "host",
        payload_summary: "Security boundary approval pending from human maintainer",
      },
      {
        event_id: "EVT-003",
        run_id: "RUN-dep-review-20260823-001",
        attempt: 1,
        step_ref: "STEP-04-publication-evaluation",
        timestamp: "2026-08-23T12:28:00Z",
        event_type: "waiting_for_inspection",
        host_trace_id: "trace-host-003",
        owner_reference: "tracker",
        payload_summary: "Process loss followed review publication; awaiting owner inspection receipt",
      },
    ],
  };
}

export function createDefaultHarnessProject(): HarnessProject {
  return {
    format: "harness-project/1",
    id: "dependency-review-continuation-harness",
    version: "1.0.0",
    status: "active",
    source_pins: {
      guide_version: "1.0.0",
      guide_digest: "sha256:designing-methodological-guides-v1",
      method_contract_version: "1.0.0-draft",
      method_contract_digest: "sha256:methodological-guide-authoring-v1",
      methodology_authoring_version: "1.0.0",
      methodology_authoring_digest: "sha256:teach-methodology-skill-v1",
      harness_research_version: "2026.1",
      harness_research_digest: "sha256:harness-research-reference-v1",
      workspace_revision: "workspace-v1",
      host_capability_version: "1.0.0",
    },
    outcome_requirements: createDefaultOutcomeRequirements(),
    ownership_map: createDefaultOwnershipMap(),
    candidate_selection: createDefaultCandidateSelection(),
    triggered_mechanisms: [...KERNEL_TRIGGERED_MECHANISMS],
    artifact_contract: createDefaultArtifactContract(),
    recovery_policy: createDefaultRecoveryPolicy(),
    lifecycle: createDefaultLifecycleRecord(),
    staged_self_application: {
      build_time_input: true,
      coordinates_two_applications: true,
      self_invocation_prohibited: true,
      runtime_recursion_prohibited: true,
    },
  };
}

export function createThinBaselineHarnessProject(): HarnessProject {
  return {
    format: "harness-project/1",
    id: "single-session-contract-validation-harness",
    version: "1.0.0",
    status: "trimmed",
    source_pins: {
      guide_version: "1.0.0",
      guide_digest: "sha256:designing-methodological-guides-v1",
      method_contract_version: "1.0.0-draft",
      method_contract_digest: "sha256:methodological-guide-authoring-v1",
      methodology_authoring_version: "1.0.0",
      methodology_authoring_digest: "sha256:teach-methodology-skill-v1",
      harness_research_version: "2026.1",
      harness_research_digest: "sha256:harness-research-reference-v1",
      workspace_revision: "workspace-v1",
      host_capability_version: "1.0.0",
    },
    outcome_requirements: {
      success_outcomes: ["Contract validation passes in single session without continuation or side effects"],
      failure_outcomes: ["Invalid contract syntax is rejected"],
      waiting_outcomes: [],
      stop_outcomes: ["Stop immediately on syntax failure"],
      observable_fixtures: [
        {
          name: "contract_validation_fixture",
          trigger: "Single-session read-only contract check",
          expected_outcome: "Contract validation passes; no kernel mechanisms required",
          observable_receipt: "RECEIPT-contract-val-ok",
        },
      ],
    },
    ownership_map: createDefaultOwnershipMap(),
    candidate_selection: {
      evaluations: [
        {
          candidate_name: "thin_baseline",
          status: "eligible",
          hard_requirements_checked: [
            {
              requirement: "Single session contract validation",
              passed: true,
              reason: "Thin skill loader and contract validator satisfy the single-session requirement directly",
            },
          ],
          verdict_reason: "Thin baseline satisfies every required outcome; no kernel needed",
        },
        {
          candidate_name: "minimal_neutral_kernel",
          status: "ineligible",
          hard_requirements_checked: [
            {
              requirement: "Necessity criterion",
              passed: false,
              reason: "Kernel adds unneeded complexity since no continuation or side-effect triggers fired",
            },
          ],
          verdict_reason: "Ineligible because thinner baseline satisfies all requirements",
        },
      ],
      selected_candidate: "thin_baseline",
      selection_rationale: "Selected thin baseline and trimmed/deleted proposed kernel",
    },
    triggered_mechanisms: [],
    recovery_policy: createDefaultRecoveryPolicy(),
    lifecycle: {
      ...createDefaultLifecycleRecord(),
      kernel_deletion_rule: "Kernel deleted because thin baseline satisfied all requirements",
    },
    staged_self_application: {
      build_time_input: true,
      coordinates_two_applications: false,
      self_invocation_prohibited: true,
      runtime_recursion_prohibited: true,
    },
  };
}

export function verifyHarnessProject(project: HarnessProject): HarnessVerificationResult {
  const problems: string[] = [];
  const diagnostics: Array<{ path: string; message: string }> = [];

  if (project.format !== "harness-project/1") {
    problems.push(`Invalid format: expected 'harness-project/1', got '${project.format}'`);
  }

  // 1. Source Pins
  const pins = project.source_pins;
  if (!pins) {
    problems.push("Missing source_pins");
  } else {
    if (!pins.method_contract_version || !pins.method_contract_digest) {
      problems.push("Method contract version and digest must be pinned");
    }
    if (!pins.harness_research_version || !pins.harness_research_digest) {
      problems.push("Harness research version and digest must be pinned");
    }
  }

  // 2. Outcome Requirements
  const reqs = project.outcome_requirements;
  if (!reqs) {
    problems.push("Missing outcome_requirements");
  } else {
    if (!reqs.success_outcomes || reqs.success_outcomes.length === 0) {
      problems.push("Outcome requirements must define at least one success outcome");
    }
    if (!reqs.failure_outcomes || reqs.failure_outcomes.length === 0) {
      problems.push("Outcome requirements must define at least one failure outcome");
    }
    if (!reqs.stop_outcomes || reqs.stop_outcomes.length === 0) {
      problems.push("Outcome requirements must define at least one stop outcome");
    }
  }

  // 3. Ownership Map (Single Ownership & No Shadow State)
  const owners = project.ownership_map;
  if (!owners) {
    problems.push("Missing ownership_map");
  } else {
    const requiredOwners = ["method", "tracker", "ariadne", "host", "orchestration_harness"] as const;
    for (const ownerKey of requiredOwners) {
      const ownerObj = owners[ownerKey];
      if (!ownerObj) {
        problems.push(`Missing ownership boundary for owner: ${ownerKey}`);
      } else {
        if (!ownerObj.retained_responsibilities || ownerObj.retained_responsibilities.length === 0) {
          problems.push(`Owner ${ownerKey} must have declared retained responsibilities`);
        }
      }
    }

    // Check that orchestration harness does NOT copy owner state
    const harnessOwner = owners.orchestration_harness;
    if (harnessOwner) {
      const prohibitedText = harnessOwner.prohibited_responsibilities.join(" ").toLowerCase();
      if (!prohibitedText.includes("copying") && !prohibitedText.includes("shadow")) {
        problems.push("Orchestration harness must explicitly prohibit copying owner state / shadow state");
      }
    }
  }

  // 4. Candidate Selection & Trimming
  const selection = project.candidate_selection;
  if (!selection) {
    problems.push("Missing candidate_selection");
  } else {
    const isThin = selection.selected_candidate === "thin_baseline";
    if (isThin) {
      if (project.triggered_mechanisms && project.triggered_mechanisms.length > 0) {
        problems.push("A passing thin baseline must trim/delete all kernel mechanisms");
      }
    } else if (selection.selected_candidate === "minimal_neutral_kernel") {
      if (!project.triggered_mechanisms || project.triggered_mechanisms.length === 0) {
        problems.push("Selected minimal neutral kernel must declare observed triggered mechanisms");
      } else {
        const validOwners = ["method", "tracker", "ariadne", "host", "orchestration_harness"];
        for (const tm of project.triggered_mechanisms) {
          if (!tm.observable_condition || tm.observable_condition.trim() === "") {
            problems.push("Every retained mechanism must have an observed trigger condition");
          }
          if (!tm.smallest_mechanism_added || tm.smallest_mechanism_added.trim() === "") {
            problems.push("Every retained mechanism must specify the smallest mechanism added");
          }
          if (tm.trigger_observed !== true) {
            problems.push(`Mechanism '${tm.smallest_mechanism_added}' must have an observed trigger (trigger_observed must be true)`);
          }
          if (!tm.necessity_criterion || tm.necessity_criterion.trim() === "") {
            problems.push(`Mechanism '${tm.smallest_mechanism_added}' must have a non-empty executable necessity criterion`);
          }
          if (!tm.owner || !validOwners.includes(tm.owner)) {
            problems.push(`Mechanism '${tm.smallest_mechanism_added}' must declare a valid single owner`);
          }
        }
      }
      if (!project.artifact_contract) {
        problems.push("Minimal neutral kernel requires an artifact_contract");
      }
    }
  }

  // 5. Artifact Contract (Pointer-only, no copied payloads)
  if (project.artifact_contract) {
    const ac = project.artifact_contract;
    if (!ac.context_manifest || ac.context_manifest.length === 0) {
      problems.push("Artifact contract must contain context_manifest pointers");
    } else {
      for (const ptr of ac.context_manifest) {
        if (!ptr.pointer_id || !ptr.digest || !ptr.owner || !ptr.target_uri) {
          problems.push(`Invalid context manifest pointer: ${JSON.stringify(ptr)}`);
        }
      }
    }

    if (!ac.attempt_cursor) {
      problems.push("Artifact contract must contain attempt_cursor");
    } else {
      const validStatuses = ["created", "running", "waiting", "succeeded", "failed", "canceled"];
      if (!validStatuses.includes(ac.attempt_cursor.status)) {
        problems.push(`Invalid attempt cursor status: ${ac.attempt_cursor.status}`);
      }
      if (!ac.attempt_cursor.idempotency_key) {
        problems.push("Attempt cursor must define idempotency_key");
      }
    }

    if (!ac.host_adapter) {
      problems.push("Artifact contract must contain host_adapter");
    } else {
      if (!ac.host_adapter.capabilities || !ac.host_adapter.interface_methods) {
        problems.push("Host adapter must declare capabilities and interface_methods");
      }
    }
  }

  // 6. Recovery Policy
  const rp = project.recovery_policy;
  if (!rp) {
    problems.push("Missing recovery_policy");
  } else {
    if (!rp.ambiguous_side_effect || rp.ambiguous_side_effect.action !== "stop_retries_and_await_owner_inspection_receipt") {
      problems.push("Recovery policy must stop retries and await owner inspection receipt for ambiguous side effects");
    }
    if (!rp.human_or_approval_pending || rp.human_or_approval_pending.action !== "remain_waiting_with_resolvable_pointer") {
      problems.push("Recovery policy must remain waiting with resolvable pointer for pending approvals");
    }
  }

  // 7. Lifecycle Records
  const lc = project.lifecycle;
  if (!lc) {
    problems.push("Missing lifecycle record");
  } else {
    if (!lc.kernel_deletion_rule) {
      problems.push("Lifecycle record must include kernel_deletion_rule");
    }
  }

  // 8. Staged Self-Application
  if (project.staged_self_application) {
    if (!project.staged_self_application.self_invocation_prohibited) {
      problems.push("Staged self-application must prohibit self-invocation");
    }
    if (!project.staged_self_application.runtime_recursion_prohibited) {
      problems.push("Staged self-application must prohibit runtime recursion");
    }
  }

  return {
    valid: problems.length === 0,
    problems,
    diagnostics,
  };
}
