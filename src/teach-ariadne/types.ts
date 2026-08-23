import type { MaterializedGraph } from "../graph/storage.js";
import type { Node } from "../core/schemas/nodes.js";

export type TeachingPhase =
  | "not_started"
  | "orient"
  | "uncertainty"
  | "framed"
  | "explored"
  | "selected"
  | "validated"
  | "explained"
  | "faded_practice"
  | "transfer"
  | "complete"
  | "blocked";

export type TeachingStatus = "learning" | "independent" | "rejected";

export interface FadedCaseSolution {
  mechanism: string;
  claimLevel: string;
  rejectedCandidates?: string[];
}

export interface DeclaredInputItem {
  id: string;
  role: string;
  source: string;
  digest?: string;
}

export interface DeclaredInputManifest {
  taskId: string;
  taskDescription: string;
  declaredInputs: DeclaredInputItem[];
}

export interface SelfExplanationAnswers {
  q1_mechanism_vs_requirement: string;
  q2_hard_filter_rationale: string;
  q3_evidence_rung_scope: string;
  q4_unloaded_rules_rationale: string;
}

export interface CompletionResult {
  passed: boolean;
  blockers: string[];
}

export type TeachingFaultType =
  | "invalid_artifact"
  | "evidence_mismatch"
  | "owner_boundary";

export interface TeachingFault {
  type: TeachingFaultType;
  targetId?: string;
  details: string;
  timestamp: string;
  resolved: boolean;
}

export interface RepairResult {
  recovered: boolean;
  preservedArtifacts: string[];
  message: string;
}

export interface OwnerBoundaryRepairResult {
  recovered: boolean;
  isolatedPath: string;
  message: string;
}

export interface AriadneTeachingState {
  phase: TeachingPhase;
  status: TeachingStatus;
  currentSource: string;
  loadedSources: string[];
  artifacts: string[];
  manifest: DeclaredInputManifest;
  meaningfulTaskAttempted: boolean;
  selectedCandidate?: string;
  rejectedCandidates: string[];
  runnableCheckPassed: boolean;
  selfExplanationSubmitted: boolean;
  selfExplanationAnswers?: SelfExplanationAnswers;
  fadedCaseCompleted: boolean;
  transferRouteCompleted: boolean;
  transferRoute?: string[];
  bulkLoadedRules: boolean;
  copiedMethodContractProse: boolean;
  isolatedGraphPath: string;
  lastMessage: string;
  faults: TeachingFault[];
  interventions: string[];
  prohibitedInputsDetected: string[];
}

export interface ParserCheckResult {
  passed: boolean;
  casesCount: number;
  results: Array<{
    input: string;
    output?: [string, string];
    error?: string;
    passed: boolean;
  }>;
}

export interface AriadneRunReceipt {
  id: string;
  type: string;
  rung: number;
  method: string;
  environment: string;
  verdict: string;
  digest: string;
}

export interface AriadneRunReport {
  taskId: string;
  status: TeachingStatus;
  declaredInputs: DeclaredInputItem[];
  prohibitedInputs: string[];
  interventions: string[];
  routeChoices: string[];
  artifacts: string[];
  receipts: AriadneRunReceipt[];
}

export type ClaimStatus = "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";

export interface AriadneClaimEvaluation {
  claim: string;
  status: ClaimStatus;
  evidence: string;
  justification: string;
  details?: Record<string, unknown>;
}

export interface AriadneClaimsReport {
  overallPassed: boolean;
  claims: {
    recall: AriadneClaimEvaluation;
    faded_performance: AriadneClaimEvaluation;
    structural_transfer: AriadneClaimEvaluation;
    targeted_recovery: AriadneClaimEvaluation;
  };
}
