export const NODE_TYPES = [
  "TASK",
  "FRAME",
  "OBS",
  "CLM",
  "HYP",
  "CTR",
  "TRF",
  "SPACE",
  "CAN",
  "UNK",
  "ASM",
  "DEP",
  "DYN",
  "VAL-SELECT",
  "EVDREQ",
  "EVD",
  "VAL",
  "TRANS",
  "DEC",
  "STATE",
  "HANDOFF",
  "LEAN-TASK",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const PROVENANCE_TYPES = [
  "UNKNOWN",
  "ASSUMED",
  "PROPOSED",
  "DERIVED",
  "MEASURED",
  "FACT",
  "DECIDED",
] as const;

export type ProvenanceType = (typeof PROVENANCE_TYPES)[number];

export const TRANSITION_LIFECYCLE = [
  "PROPOSED",
  "EXPANDED",
  "DUAL_RUNNING",
  "MIGRATING",
  "CONTRACTED",
  "RETIRED",
] as const;

export type TransitionLifecycle = (typeof TRANSITION_LIFECYCLE)[number];

export type NodeId = `${NodeType}-${string}`;

export interface EpistemicNode {
  id: NodeId;
  type: NodeType;
  provenance_type: ProvenanceType;
  statement: string;
  title?: string;
  confidence_level?: number;
  dependencies?: NodeId[];
  falsification_conditions?: string[];
  status?: string;
  [key: string]: unknown;
}

type GenericCanonicalNode<T extends NodeType> = EpistemicNode & {
  type: T;
  id: `${T}-${string}`;
};

export interface ClaimNode extends GenericCanonicalNode<"CLM"> {
  claim_class?: string;
}

export interface EvidenceRequestNode extends GenericCanonicalNode<"EVDREQ"> {
  claim?: NodeId;
  candidate?: NodeId;
  claim_class?: string;
  minimum_rung?: number | string;
  required_rung?: number | string;
  pass_condition?: string;
  fail_condition?: string;
  providers?: string[];
}

export interface EvidenceNode extends GenericCanonicalNode<"EVD"> {
  verdict?: "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";
  method?: string;
  methodology?: string;
  rung?: number | string;
  receipt?: string | Record<string, unknown>;
  environment?: string;
  reproducible_environment?: string;
  stdout_digest?: string;
  telemetry_reference?: string;
}

export interface TransitionNode extends GenericCanonicalNode<"TRANS"> {
  target_mechanism_ref: `CAN-${string}`;
  retirement_predicate: string;
  expiration_deadline: string;
  cleanup_verification_test: string;
  owner: string;
  lifecycle_state?: TransitionLifecycle;
  transition_receipt?: string | Record<string, unknown>;
  cleanup_verification_receipt?: string | Record<string, unknown>;
  verification_receipt?: string | Record<string, unknown>;
  verified?: boolean;
}

type CanonicalNodeByType = {
  [T in NodeType]:
    T extends "CLM" ? ClaimNode :
    T extends "EVDREQ" ? EvidenceRequestNode :
    T extends "EVD" ? EvidenceNode :
    T extends "TRANS" ? TransitionNode :
    GenericCanonicalNode<T>;
};

export type CanonicalNode = CanonicalNodeByType[NodeType];

export type NodeOfType<T extends NodeType> = Extract<CanonicalNode, { type: T }>;
export type TaskNode = NodeOfType<"TASK">;
export type FrameNode = NodeOfType<"FRAME">;
export type ObservationNode = NodeOfType<"OBS">;
export type HypothesisNode = NodeOfType<"HYP">;
export type ContradictionNode = NodeOfType<"CTR">;
export type TransformationNode = NodeOfType<"TRF">;
export type SolutionSpaceNode = NodeOfType<"SPACE">;
export type CandidateNode = NodeOfType<"CAN">;
export type UnknownNode = NodeOfType<"UNK">;
export type AssumptionNode = NodeOfType<"ASM">;
export type DependencyNode = NodeOfType<"DEP">;
export type DynamicsNode = NodeOfType<"DYN">;
export type ValueSelectionNode = NodeOfType<"VAL-SELECT">;
export type ValidationNode = NodeOfType<"VAL">;
export type DecisionNode = NodeOfType<"DEC">;
export type StateNode = NodeOfType<"STATE">;
export type HandoffNode = NodeOfType<"HANDOFF">;
export type LeanTaskNode = NodeOfType<"LEAN-TASK">;
