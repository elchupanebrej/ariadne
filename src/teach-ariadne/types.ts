import type { MaterializedGraph } from "../graph/storage.js";

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
  bulkLoadedRules: boolean;
  copiedMethodContractProse: boolean;
  isolatedGraphPath: string;
  lastMessage: string;
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
