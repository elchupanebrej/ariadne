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

export function createStagedSelfApplicationDeclaredManifest(): HarnessDeclaredInputManifest {
  return {
    taskId: "staged-self-application-harness",
    taskDescription:
      "Transfer Harness Authoring to coordinate a staged acyclic self-application round that evaluates two isolated Method Contract applications without active builder self-invocation or runtime recursion.",
    declaredInputs: [
      {
        id: "staged-self-application-task",
        role: "specification",
        source: "spec.md#staged-self-application",
      },
      {
        id: "method-contract-pinned",
        role: "method-contract",
        source: "methodological-guide-authoring@1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        version: "1.0.0-draft",
      },
      {
        id: "harness-authoring-pinned",
        role: "authoring-skill",
        source: ".agents/skills/teach-harness/SKILL.md",
        digest: "sha256:teach-harness-skill-v1",
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

export const STAGED_SELF_APP_TRIGGERED_MECHANISMS: HarnessTriggerDecision[] = [
  {
    observable_condition: "Staged round inputs and hashes must be pinned and content-addressed",
    smallest_mechanism_added: "content-addressed context manifest",
    trigger_observed: true,
    necessity_criterion: "Immutable bootstrap rounds require exact pinned versions and digests of all builder inputs",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Two isolated assessment applications must execute sequentially",
    smallest_mechanism_added: "repository-visible attempt cursor",
    trigger_observed: true,
    necessity_criterion: "Harness tracks assessment round steps F_A and F_B without allowing either to invoke active builder",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Fixed-point equivalence N(F_A(M_n)) = N(M_n) = N(F_B(M_n)) must be verified",
    smallest_mechanism_added: "closed artifact and receipt gates",
    trigger_observed: true,
    necessity_criterion: "Structural promotion gate verifies normalized normative projection identity across assessors",
    owner: "orchestration_harness",
  },
  {
    observable_condition: "Round divergence or normative delta must stop the round",
    smallest_mechanism_added: "version and digest pin gate",
    trigger_observed: true,
    necessity_criterion: "Any normative delta between input contract and assessor candidates stops the round for owner review",
    owner: "orchestration_harness",
  },
];

export function createStagedSelfApplicationOutcomeRequirements(): HarnessOutcomeRequirements {
  return {
    success_outcomes: [
      "Two isolated Method Contract applications produce identical normalized normative projections",
      "Fixed-point identity N(F_A(M_n)) = N(M_n) = N(F_B(M_n)) holds with zero runtime cycles",
    ],
    failure_outcomes: [
      "Any normative delta or assessor disagreement halts the immutable round",
      "Attempted self-invocation or active rewriting fails closed with an acyclicity violation",
    ],
    waiting_outcomes: [
      "Owner approval required for candidate promotion after fixed-point verification",
    ],
    stop_outcomes: [
      "Immediate halt if runtime recursion or circular builder dependency is detected",
    ],
    observable_fixtures: [
      {
        name: "fixed_point_identity_fixture",
        trigger: "Two isolated assessors F_A and F_B evaluate input M_n",
        expected_outcome: "Emits matching normalized normative projections and structural promotion receipt",
        observable_receipt: "RECEIPT-fixed-point-identity",
      },
      {
        name: "runtime_recursion_rejection_fixture",
        trigger: "Harness attempts to invoke active teaching skill during round execution",
        expected_outcome: "Fails closed immediately with runtime recursion error",
        observable_receipt: "RECEIPT-recursion-rejected",
      },
    ],
  };
}

export function createStagedSelfApplicationCandidateSelection(): HarnessCandidateSelection {
  return {
    evaluations: [
      {
        candidate_name: "thin_baseline",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Acyclic two-application coordination",
            passed: false,
            reason: "Thin baseline cannot serialize two isolated assessment runs with fixed-point comparison gates",
          },
        ],
        verdict_reason: "Fails isolated multi-application coordination requirement",
      },
      {
        candidate_name: "host_plugin",
        status: "ineligible",
        hard_requirements_checked: [
          {
            requirement: "Host neutrality",
            passed: false,
            reason: "Coupled to host-specific plugin architecture",
          },
        ],
        verdict_reason: "Fails host-neutral requirement",
      },
      {
        candidate_name: "minimal_neutral_kernel",
        status: "provisionally_retained",
        hard_requirements_checked: [
          {
            requirement: "Acyclic build-time boundary enforcement",
            passed: true,
            reason: "Treats builder skills strictly as immutable build-time inputs; prohibits runtime recursion",
          },
          {
            requirement: "Fixed-point comparison gate",
            passed: true,
            reason: "Validates N(F_A(M_n)) = N(M_n) = N(F_B(M_n)) deterministically",
          },
          {
            requirement: "Host neutrality",
            passed: true,
            reason: "Uses pointer-only ledger and standard host capability adapter",
          },
        ],
        verdict_reason: "Passes all static and runtime acyclicity requirements",
      },
    ],
    selected_candidate: "minimal_neutral_kernel",
    selection_rationale:
      "Minimal neutral kernel coordinates two isolated assessment rounds with fixed-point verification and acyclic boundary enforcement",
  };
}

export function createStagedSelfApplicationArtifactContract(): HarnessArtifactContract {
  return {
    context_manifest: [
      {
        pointer_id: "CTX-STAGED-001-contract",
        media_type: "application/json",
        role: "method-contract",
        version: "1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        owner: "method",
        target_uri: "method-contract://methodological-guide-authoring/1",
      },
      {
        pointer_id: "CTX-STAGED-002-harness-skill",
        media_type: "text/markdown",
        role: "authoring-skill",
        version: "1.0.0",
        digest: "sha256:teach-harness-skill-v1",
        owner: "method",
        target_uri: "file://.agents/skills/teach-harness/SKILL.md",
      },
    ],
    attempt_cursor: {
      run_id: "RUN-staged-self-app-001",
      step_ref: "STEP-02-fixed-point-assessment",
      status: "running",
      attempt: 1,
      idempotency_key: "IDEM-staged-self-app-round-1",
      deadline: "2026-08-23T16:00:00Z",
      event_cursor: 6,
      pinned_sources: {
        method_contract: "sha256:methodological-guide-authoring-v1",
        skills: ["sha256:teach-harness-skill-v1"],
        adapter: "host-capabilities@1.0.0",
        workspace: "workspace-v1",
        inputs: "sha256:methodological-guide-authoring-v1",
      },
      owner_receipt_pointers: ["RECEIPT-fixed-point-identity"],
      artifact_pointers: ["ART-assessor-a-candidate", "ART-assessor-b-candidate"],
      pending_action_pointers: [],
    },
    artifact_envelopes: [
      {
        schema_version: "self-application-artifact/1",
        artifact_id: "ART-assessor-a-candidate",
        kind: "MethodContractCandidate",
        producing_run_id: "RUN-staged-self-app-001",
        producing_step_ref: "STEP-02-fixed-point-assessment",
        producing_attempt: 1,
        pinned_input_pointers: ["CTX-STAGED-001-contract"],
        output_pointer: "file://artifacts/assessor-a-candidate.json",
        output_digest: "sha256:assessor-a-normative-digest-v1",
        owner_receipt_pointers: ["RECEIPT-assessor-a-complete"],
        status: "validated",
        completion_predicate_result: {
          passed: true,
          predicate_id: "PRED-normative-projection-equal",
          evaluated_at: "2026-08-23T12:31:00Z",
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
        event_id: "EVT-STAGED-001",
        run_id: "RUN-staged-self-app-001",
        attempt: 1,
        step_ref: "STEP-01-bootstrap-round",
        timestamp: "2026-08-23T12:28:00Z",
        event_type: "round_started",
        host_trace_id: "trace-staged-001",
        owner_reference: "orchestration_harness",
        payload_summary: "Loaded immutable round-1 pins and initialized assessment",
      },
    ],
  };
}

export function createStagedSelfApplicationLifecycleRecord(): HarnessLifecycleRecord {
  return {
    ownership: "Method Contract Owner & Verification Assessor",
    version: "1.0.0",
    source_pins: {
      method_contract: "methodological-guide-authoring@1.0.0-draft (sha256:methodological-guide-authoring-v1)",
      harness_research: "references/harness-research.md@2026.1 (sha256:harness-research-reference-v1)",
      workspace_revision: "workspace-v1",
      host_adapter: "host-capabilities@1.0.0",
    },
    review_triggers: [
      "Method Contract round delta",
      "Fixed-point normalization algorithm change",
      "Assessor disagreement during self-application",
    ],
    feedback_and_deviations: "No active self-rewriting permitted; delta starts a new round",
    kernel_deletion_rule:
      "Inline or delete kernel when thin assessment runner validates fixed-point identity without stateful orchestration",
    retirement_criteria: [
      "Round-1 superseded by immutable round-2 candidate",
    ],
  };
}

export function createStagedSelfApplicationHarnessProject(): HarnessProject {
  return {
    format: "harness-project/1",
    id: "staged-self-application-harness",
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
    outcome_requirements: createStagedSelfApplicationOutcomeRequirements(),
    ownership_map: createDefaultOwnershipMap(),
    candidate_selection: createStagedSelfApplicationCandidateSelection(),
    triggered_mechanisms: [...STAGED_SELF_APP_TRIGGERED_MECHANISMS],
    artifact_contract: createStagedSelfApplicationArtifactContract(),
    recovery_policy: createDefaultRecoveryPolicy(),
    lifecycle: createStagedSelfApplicationLifecycleRecord(),
    staged_self_application: {
      build_time_input: true,
      coordinates_two_applications: true,
      self_invocation_prohibited: true,
      runtime_recursion_prohibited: true,
    },
  };
}
