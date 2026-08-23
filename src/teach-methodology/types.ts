export type MethodTeachingPhase =
  | "not_started"
  | "meaningful_task"
  | "contract_loaded"
  | "working_map"
  | "expanded_A1"
  | "expanded_A2"
  | "expanded_A3"
  | "expanded_A4"
  | "expanded_A5"
  | "expanded_A6"
  | "expanded_A7"
  | "traceable"
  | "externally_verified"
  | "explained"
  | "faded_practice"
  | "metamethodological_transfer"
  | "complete"
  | "blocked";

export type MethodTeachingStatus = "learning" | "independent" | "rejected";

export interface MethodDeclaredInputItem {
  id: string;
  role: string;
  source: string;
  digest?: string;
}

export interface MethodDeclaredInputManifest {
  taskId: string;
  taskDescription: string;
  declaredInputs: MethodDeclaredInputItem[];
}

export interface A0WorkingMap {
  user_and_situation: string;
  action: string;
  learning_path: string;
  verification: string;
  rationale_and_unknowns: string;
  next_step: string;
  expansion_signals?: Record<string, string>;
}

export interface A1MethodologyProfile {
  problem: string;
  desired_outcome: string;
  scope: string;
  priority_failure: string;
  success_criteria: string;
  assumptions: string;
}

export interface A2RationaleClaim {
  id: string;
  claim: string;
  k_level: string;
  e_class: string;
  rationale_to_recommendation: string;
  countercondition: string;
  rationale_ref: string;
  provenance?: string;
  epistemic_status?: string;
}

export interface A2RationaleRegister {
  claims: A2RationaleClaim[];
}

export interface A3UserRole {
  id: string;
  role: string;
  authority: string[];
  context?: string;
  responsibilities?: string[];
}

export interface A3UserMap {
  roles: Record<string, A3UserRole>;
  context_notes?: string;
}

export interface A4RuleBranch {
  when: string;
  then: string;
}

export interface A4RuleRecord {
  id: string;
  trigger: string;
  inputs: string[];
  action: Array<{ kind: string; [key: string]: unknown }>;
  branches: A4RuleBranch[];
  output: Record<string, unknown>;
  recovery: string;
  escalation: string;
  rationale_ref: string;
}

export interface A4DecisionMap {
  rules: A4RuleRecord[];
}

export interface A5LearningModule {
  meaningful_task: string;
  worked_example: string;
  self_explanation: string;
  incomplete_example: string;
  independent_task: string;
  transfer_error: string;
}

export interface A6VerificationProtocol {
  hypotheses: string;
  checks: string[];
  observed_criteria: string;
  decisions: string[];
  receipt_separation: string;
}

export interface A7LifecycleLog {
  ownership: string;
  version: string;
  pins: {
    contract: string;
    guide: string;
  };
  review_triggers: string[];
  feedback_and_deviations: string;
  distribution_and_retirement: string;
}

export interface TraceabilityRow {
  rule_id: string;
  claim_id: string;
  learning_id: string;
  verification_id: string;
  lifecycle_version: string;
}

export interface GuideProject {
  format: "methodological-guide-project/1";
  id: string;
  version: string;
  status: string;
  contract_pin: {
    id: string;
    version: string;
    digest: string;
    profile: string;
  };
  guide_pin: {
    href: string;
    digest?: string;
  };
  artifacts: {
    A0: A0WorkingMap;
    A1: A1MethodologyProfile;
    A2: A2RationaleRegister;
    A3: A3UserMap;
    A4: A4DecisionMap;
    A5: A5LearningModule;
    A6: A6VerificationProtocol;
    A7: A7LifecycleLog;
  };
  traceability: TraceabilityRow[];
  receipts?: Record<string, unknown>;
}

export interface MethodTeachingState {
  phase: MethodTeachingPhase;
  status: MethodTeachingStatus;
  currentSource: string;
  task: boolean;
  contractPinned: boolean;
  contractPin: string;
  completionProfile: string;
  artifacts: Record<string, string | unknown>;
  links: string[];
  externalReceipt: boolean;
  selfConsistencyReceipt: boolean;
  selfConsistencySeparated: boolean;
  selfExplanation: boolean;
  fadedCase: boolean;
  transferCase: boolean;
  recoveryPracticed: boolean;
  brokenLink: boolean;
  shadowContract: boolean;
  circularProof: boolean;
  lastMessage: string;
  manifest: MethodDeclaredInputManifest;
  prohibitedInputsDetected: string[];
}

export interface GuideVerificationResult {
  valid: boolean;
  problems: string[];
  diagnostics?: Array<{ path: string; message: string }>;
}

export interface PrototypeSelfCheckResult {
  passed: boolean;
  pathsPassed: number;
  message: string;
}
