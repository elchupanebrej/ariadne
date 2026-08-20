export const NODE_TYPES = [
  "TASK",
  "FRAME",
  "OBS",
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

export type NodeId = `${NodeType}-${string}`;

export interface EpistemicNode {
  id: NodeId;
  type: NodeType;
  provenance_type: ProvenanceType;
  statement: string;
  confidence_level?: number;
  dependencies?: NodeId[];
  falsification_conditions?: string[];
  status?: string;
  [key: string]: unknown;
}

export type CanonicalNode = {
  [T in NodeType]: EpistemicNode & { type: T; id: `${T}-${string}` };
}[NodeType];

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
export type EvidenceRequestNode = NodeOfType<"EVDREQ">;
export type EvidenceNode = NodeOfType<"EVD">;
export type ValidationNode = NodeOfType<"VAL">;
export type TransitionNode = NodeOfType<"TRANS">;
export type DecisionNode = NodeOfType<"DEC">;
export type StateNode = NodeOfType<"STATE">;
export type HandoffNode = NodeOfType<"HANDOFF">;
export type LeanTaskNode = NodeOfType<"LEAN-TASK">;
