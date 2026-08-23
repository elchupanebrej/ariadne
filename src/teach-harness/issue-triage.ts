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
} from "./types.js";
import {
  createDefaultOwnershipMap,
  createDefaultRecoveryPolicy,
} from "./verifier.js";

export function createIssueTriageDeclaredManifest(): HarnessDeclaredInputManifest {
  return {
    taskId: "issue-triage-continuation-harness",
    taskDescription:
      "Design a minimal host-neutral harness for an issue triage workflow across fresh sessions that classifies incoming issues into canonical triage roles, pauses on human maintainer decisions, and validates label updates against the 5-role triage taxonomy.",
    declaredInputs: [
      {
        id: "issue-tracker-guide-pinned",
        role: "normative-guide",
        source: "docs/agents/issue-tracker.md",
        digest: "sha256:issue-tracker-doc-v1",
        version: "1.0.0",
      },
      {
        id: "triage-labels-guide-pinned",
        role: "normative-guide",
        source: "docs/agents/triage-labels.md",
        digest: "sha256:triage-labels-doc-v1",
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

export const ISSUE_TRIAGE_TRIGGERED_MECHANISMS: HarnessTriggerDecision[] = [
  {
    observable_condition: "Issue triage state and context must survive fresh sessions",
    smallest_mechanism_added: "content-addressed context manifest",
    trigger_observed: true,
    necessity_criterion: "Fresh session must reload issue tracker and triage label specifications without prompt assembling",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Issue batch progression must track current issue pointer across processes",
    smallest_mechanism_added: "repository-visible attempt cursor",
    trigger_observed: true,
    necessity_criterion: "Continuation requires repository-visible run_id, current issue step_ref, and event cursor",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Triage label changes must conform to canonical 5-role taxonomy",
    smallest_mechanism_added: "closed artifact and receipt gates",
    trigger_observed: true,
    necessity_criterion: "Gate validates that assigned status is one of needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Issues requiring human maintainer decision must pause cleanly",
    smallest_mechanism_added: "pending approval pointer",
    trigger_observed: true,
    necessity_criterion: "Status ready-for-human or policy ambiguity transitions attempt to waiting with pending-action pointer",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Triage guidelines and source contract versions may drift",
    smallest_mechanism_added: "version and digest pin gate",
    trigger_observed: true,
    necessity_criterion: "Attempt startup fails closed if tracker schema or triage rules do not match pinned digests",
    owner: "orchestration_harness",
  },
];

export function createIssueTriageOutcomeRequirements(): HarnessOutcomeRequirements {
  return {
    success_outcomes: [
      "All unprocessed issues are triaged to canonical 5-role statuses with atomic file updates",
      "Valid triage decisions advance the attempt cursor to succeeded",
    ],
    failure_outcomes: [
      "Labels outside canonical 5-role triage vocabulary fail the artifact gate with repairable pointers",
      "Corrupted issue markdown files fail validation and halt batch advancement",
    ],
    waiting_outcomes: [
      "Issues requiring human maintainer decision (ready-for-human or policy escalation) transition to waiting",
      "Clarification requests (needs-info) leave attempt waiting for reporter input",
    ],
    stop_outcomes: [
      "Attempt execution halts on unpinned tracker specification or digest drift",
    ],
    observable_fixtures: [
      {
        name: "triage_classification_fixture",
        trigger: "Incoming issue evaluated against 5-role taxonomy",
        expected_outcome: "Issue marked ready-for-agent and envelope validated",
        observable_receipt: "RECEIPT-triage-classified-01",
      },
      {
        name: "human_decision_wait_fixture",
        trigger: "Issue flagged as architectural decision requiring human maintainer",
        expected_outcome: "Attempt enters waiting state with pending-action pointer for maintainer",
        observable_receipt: "RECEIPT-triage-human-waiting",
      },
      {
        name: "invalid_label_rejection_fixture",
        trigger: "Non-canonical status label 'in-progress' submitted",
        expected_outcome: "Artifact gate fails closed with schema error",
        observable_receipt: "RECEIPT-invalid-label-rejected",
      },
    ],
  };
}

export function createIssueTriageCandidateSelection(): HarnessCandidateSelection {
  return {
    evaluations: [
      {
        candidate_name: "thin_baseline",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Cold start loading from repository",
            passed: true,
            reason: "Loads triage docs into context",
          },
          {
            requirement: "Multi-session issue batch continuation",
            passed: false,
            reason: "Lacks persistent attempt cursor to track triaged issues across separate process invocations",
          },
          {
            requirement: "Human maintainer waiting pointer",
            passed: false,
            reason: "Cannot maintain repository-visible waiting state without losing session context",
          },
        ],
        verdict_reason: "Fails multi-session batch continuation and waiting state requirements non-compensatorily",
      },
      {
        candidate_name: "host_plugin",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Host neutrality across environments",
            passed: false,
            reason: "Tied to specific host session manager rather than repository-visible state",
          },
        ],
        verdict_reason: "Fails host-neutral portability requirement",
      },
      {
        candidate_name: "minimal_neutral_kernel",
        status: "provisionally_retained",
        hard_requirements_checked: [
          {
            requirement: "Multi-session issue batch continuation",
            passed: true,
            reason: "Maintains attempt cursor and context pointers across fresh processes",
          },
          {
            requirement: "Human maintainer waiting pointer",
            passed: true,
            reason: "Enters waiting state with pending-action pointer for maintainer input",
          },
          {
            requirement: "5-role triage validation gate",
            passed: true,
            reason: "Validates label envelopes deterministically against triage specification",
          },
          {
            requirement: "Host neutrality",
            passed: true,
            reason: "Uses pointer-only ledger and standard host capability adapter",
          },
        ],
        verdict_reason: "Passes all required issue-triage continuation and validation invariants",
      },
    ],
    selected_candidate: "minimal_neutral_kernel",
    selection_rationale:
      "Minimal neutral kernel satisfies multi-session triage batch continuity and human waiting pointers where thin baseline fails",
  };
}

export function createIssueTriageArtifactContract(): HarnessArtifactContract {
  return {
    context_manifest: [
      {
        pointer_id: "CTX-TRIAGE-001-labels",
        media_type: "text/markdown",
        role: "normative-guide",
        version: "1.0.0",
        digest: "sha256:triage-labels-doc-v1",
        owner: "method",
        target_uri: "file://docs/agents/triage-labels.md",
      },
      {
        pointer_id: "CTX-TRIAGE-002-tracker",
        media_type: "text/markdown",
        role: "normative-guide",
        version: "1.0.0",
        digest: "sha256:issue-tracker-doc-v1",
        owner: "tracker",
        target_uri: "file://docs/agents/issue-tracker.md",
      },
    ],
    attempt_cursor: {
      run_id: "RUN-triage-20260823-001",
      step_ref: "STEP-triage-issue-08",
      status: "running",
      attempt: 1,
      idempotency_key: "IDEM-triage-issue-08",
      deadline: "2026-08-23T15:00:00Z",
      event_cursor: 4,
      pinned_sources: {
        method_contract: "sha256:methodological-guide-authoring-v1",
        skills: ["sha256:teach-harness-skill-v1"],
        adapter: "host-capabilities@1.0.0",
        workspace: "workspace-v1",
        inputs: "sha256:triage-labels-doc-v1",
      },
      owner_receipt_pointers: ["RECEIPT-triage-classified-01"],
      artifact_pointers: ["ART-triage-issue-08-envelope"],
      pending_action_pointers: [],
    },
    artifact_envelopes: [
      {
        schema_version: "triage-artifact/1",
        artifact_id: "ART-triage-issue-08-envelope",
        kind: "IssueTriageDecision",
        producing_run_id: "RUN-triage-20260823-001",
        producing_step_ref: "STEP-triage-issue-08",
        producing_attempt: 1,
        pinned_input_pointers: ["CTX-TRIAGE-001-labels", "CTX-TRIAGE-002-tracker"],
        output_pointer: "file://.scratch/issues/08-verify-harness-transfer.md",
        output_digest: "sha256:triage-issue-08-digest-v1",
        owner_receipt_pointers: ["RECEIPT-triage-classified-01"],
        status: "validated",
        completion_predicate_result: {
          passed: true,
          predicate_id: "PRED-canonical-5-role-label",
          evaluated_at: "2026-08-23T12:30:00Z",
        },
      },
    ],
    host_adapter: {
      adapter_id: "host-adapter-standard-v1",
      capabilities: {
        supported_versions: ["1.0.0"],
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
        event_id: "EVT-TRIAGE-001",
        run_id: "RUN-triage-20260823-001",
        attempt: 1,
        step_ref: "STEP-triage-issue-08",
        timestamp: "2026-08-23T12:29:00Z",
        event_type: "attempt_started",
        host_trace_id: "trace-triage-001",
        owner_reference: "orchestration_harness",
        payload_summary: "Loaded issue tracker manifest and began triage batch",
      },
    ],
  };
}

export function createIssueTriageLifecycleRecord(): HarnessLifecycleRecord {
  return {
    ownership: "Issue Triage Maintainer & Method Owner",
    version: "1.0.0",
    source_pins: {
      method_contract: "methodological-guide-authoring@1.0.0-draft (sha256:methodological-guide-authoring-v1)",
      harness_research: "references/harness-research.md@2026.1 (sha256:harness-research-reference-v1)",
      workspace_revision: "workspace-v1",
      host_adapter: "host-capabilities@1.0.0",
    },
    review_triggers: [
      "Triage taxonomy rule changes",
      "Tracker format migration",
      "Repeated human triage escalation patterns",
    ],
    feedback_and_deviations: "No deviations from 5-role triage taxonomy permitted",
    kernel_deletion_rule:
      "Inline or delete kernel when thin issue triage script satisfies batch resumption and waiting state",
    retirement_criteria: [
      "Issue tracker replaced by external service with native durable cursors",
    ],
  };
}

export function createIssueTriageHarnessProject(): HarnessProject {
  return {
    format: "harness-project/1",
    id: "issue-triage-continuation-harness",
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
    outcome_requirements: createIssueTriageOutcomeRequirements(),
    ownership_map: createDefaultOwnershipMap(),
    candidate_selection: createIssueTriageCandidateSelection(),
    triggered_mechanisms: [...ISSUE_TRIAGE_TRIGGERED_MECHANISMS],
    artifact_contract: createIssueTriageArtifactContract(),
    recovery_policy: createDefaultRecoveryPolicy(),
    lifecycle: createIssueTriageLifecycleRecord(),
    staged_self_application: {
      build_time_input: true,
      coordinates_two_applications: false,
      self_invocation_prohibited: true,
      runtime_recursion_prohibited: true,
    },
  };
}
