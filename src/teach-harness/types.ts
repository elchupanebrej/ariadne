export type HarnessTeachingPhase =
  | "not_started"
  | "meaningful_task"
  | "sources_pinned"
  | "outcome_tests"
  | "ownership_boundary"
  | "baseline_measured"
  | "candidate_selected"
  | "triggered_mechanisms"
  | "artifact_contract"
  | "waiting_for_inspection"
  | "recovered"
  | "evaluated"
  | "lifecycle_recorded"
  | "explained"
  | "faded_practice"
  | "staged_transfer"
  | "complete"
  | "blocked";

export type HarnessTeachingStatus =
  | "learning"
  | "independent"
  | "trimmed"
  | "rejected";

export interface HarnessDeclaredInputItem {
  id: string;
  role: string;
  source: string;
  digest?: string;
  version?: string;
}

export interface HarnessDeclaredInputManifest {
  taskId: string;
  taskDescription: string;
  declaredInputs: HarnessDeclaredInputItem[];
}

export interface HarnessOutcomeRequirements {
  success_outcomes: string[];
  failure_outcomes: string[];
  waiting_outcomes: string[];
  stop_outcomes: string[];
  observable_fixtures: Array<{
    name: string;
    trigger: string;
    expected_outcome: string;
    observable_receipt?: string;
  }>;
}

export interface HarnessOwnerResponsibility {
  owner: "method" | "tracker" | "ariadne" | "host" | "orchestration_harness";
  retained_responsibilities: string[];
  prohibited_responsibilities: string[];
  state_boundary: string;
}

export interface HarnessOwnershipMap {
  method: HarnessOwnerResponsibility;
  tracker: HarnessOwnerResponsibility;
  ariadne: HarnessOwnerResponsibility;
  host: HarnessOwnerResponsibility;
  orchestration_harness: HarnessOwnerResponsibility;
}

export interface CandidateEvaluationResult {
  candidate_name: "thin_baseline" | "host_plugin" | "minimal_neutral_kernel";
  status: "eligible" | "ineligible" | "provisionally_retained";
  hard_requirements_checked: Array<{
    requirement: string;
    passed: boolean;
    reason: string;
  }>;
  verdict_reason: string;
}

export interface HarnessCandidateSelection {
  evaluations: CandidateEvaluationResult[];
  selected_candidate: "thin_baseline" | "host_plugin" | "minimal_neutral_kernel";
  selection_rationale: string;
}

export interface HarnessTriggerDecision {
  observable_condition: string;
  smallest_mechanism_added: string;
  trigger_observed: boolean;
  necessity_criterion: string;
}

export interface ContextManifestPointer {
  pointer_id: string;
  media_type: string;
  role: string;
  version: string;
  digest: string;
  owner: string;
  target_uri: string;
}

export interface AttemptCursorRecord {
  run_id: string;
  step_ref: string;
  status: "created" | "running" | "waiting" | "succeeded" | "failed" | "canceled";
  attempt: number;
  idempotency_key: string;
  deadline: string;
  event_cursor: number;
  pinned_sources: {
    method_contract: string;
    skills: string[];
    adapter: string;
    workspace: string;
    inputs: string;
  };
  owner_receipt_pointers: string[];
  artifact_pointers: string[];
  pending_action_pointers: string[];
}

export interface ArtifactEnvelopeRecord {
  schema_version: string;
  artifact_id: string;
  kind: string;
  producing_run_id: string;
  producing_step_ref: string;
  producing_attempt: number;
  pinned_input_pointers: string[];
  output_pointer: string;
  output_digest: string;
  owner_receipt_pointers: string[];
  status: string;
  completion_predicate_result: {
    passed: boolean;
    predicate_id: string;
    evaluated_at: string;
  };
}

export interface HostCapabilityAdapterContract {
  adapter_id: string;
  capabilities: {
    supported_versions: string[];
    supports_resume: boolean;
    supports_native_approvals: boolean;
    supports_trace_correlation: boolean;
    sandbox_isolation_level: string;
  };
  interface_methods: {
    capabilities: string;
    start: string;
    resume: string;
    cancel: string;
    events: string;
  };
}

export interface NormalizedLifecycleEvent {
  event_id: string;
  run_id: string;
  attempt: number;
  step_ref: string;
  timestamp: string;
  event_type: string;
  host_trace_id: string;
  owner_reference?: string;
  payload_summary?: string;
}

export interface HarnessArtifactContract {
  context_manifest: ContextManifestPointer[];
  attempt_cursor: AttemptCursorRecord;
  artifact_envelopes: ArtifactEnvelopeRecord[];
  host_adapter: HostCapabilityAdapterContract;
  normalized_events: NormalizedLifecycleEvent[];
}

export interface HarnessRecoveryPolicy {
  pin_mismatch: {
    action: "stop";
    resolution: string;
  };
  invalid_artifact_or_receipt: {
    action: "stop_and_repair_named_owner_artifact";
    resolution: string;
  };
  human_or_approval_pending: {
    action: "remain_waiting_with_resolvable_pointer";
    resolution: string;
  };
  ambiguous_side_effect: {
    action: "stop_retries_and_await_owner_inspection_receipt";
    resolution: string;
  };
  unsupported_capability: {
    action: "fail_closed";
    resolution: string;
  };
  normative_delta: {
    action: "stop_immutable_round";
    resolution: string;
  };
}

export interface HarnessLifecycleRecord {
  ownership: string;
  version: string;
  source_pins: {
    method_contract: string;
    harness_research: string;
    workspace_revision: string;
    host_adapter: string;
  };
  review_triggers: string[];
  feedback_and_deviations: string;
  kernel_deletion_rule: string;
  retirement_criteria: string[];
}

export interface HarnessProject {
  format: "harness-project/1";
  id: string;
  version: string;
  status: string;
  source_pins: {
    guide_version: string;
    guide_digest: string;
    method_contract_version: string;
    method_contract_digest: string;
    methodology_authoring_version: string;
    methodology_authoring_digest: string;
    harness_research_version: string;
    harness_research_digest: string;
    workspace_revision: string;
    host_capability_version: string;
  };
  outcome_requirements: HarnessOutcomeRequirements;
  ownership_map: HarnessOwnershipMap;
  candidate_selection: HarnessCandidateSelection;
  triggered_mechanisms: HarnessTriggerDecision[];
  artifact_contract?: HarnessArtifactContract;
  recovery_policy: HarnessRecoveryPolicy;
  lifecycle: HarnessLifecycleRecord;
  staged_self_application?: {
    build_time_input: boolean;
    coordinates_two_applications: boolean;
    self_invocation_prohibited: boolean;
    runtime_recursion_prohibited: boolean;
  };
}

export interface HarnessTeachingFault {
  type:
    | "pin_mismatch"
    | "shadow_state"
    | "ambiguous_effect_duplicate_replay"
    | "untested_baseline"
    | "runtime_recursion";
  details: string;
  resolved: boolean;
  timestamp: string;
}

export interface HarnessTeachingState {
  phase: HarnessTeachingPhase;
  status: HarnessTeachingStatus;
  taskClass: "none" | "cross-session" | "single-session";
  pins: boolean;
  requirements: string[];
  ownersPlaced: boolean;
  baselineTested: boolean;
  baselineFailures: string[];
  candidate: "unselected" | "minimal neutral kernel" | "thin baseline" | "host-specific plugin";
  features: string[];
  artifactContract: boolean;
  ambiguousEffect: boolean;
  recoveryPracticed: boolean;
  evaluated: boolean;
  lifecycle: boolean;
  selfExplanation: boolean;
  fadedCase: boolean;
  transferCase: boolean;
  shadowState: boolean;
  duplicateEffect: boolean;
  pinDrift: boolean;
  runtimeRecursion: boolean;
  lastMessage: string;
  manifest: HarnessDeclaredInputManifest;
  prohibitedInputsDetected: string[];
  interventions: string[];
  routeChoices: string[];
  faults: HarnessTeachingFault[];
}

export interface HarnessVerificationResult {
  valid: boolean;
  problems: string[];
  diagnostics?: Array<{ path: string; message: string }>;
}

export interface HarnessSelfCheckResult {
  passed: boolean;
  pathsPassed: number;
  message: string;
}
