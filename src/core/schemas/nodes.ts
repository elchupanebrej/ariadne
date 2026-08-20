import { z } from "zod";
import {
  NODE_TYPES,
  PROVENANCE_TYPES,
  type NodeType,
} from "../types/nodes.js";

export { NODE_TYPES } from "../types/nodes.js";
export type { NodeType } from "../types/nodes.js";

const NODE_ID_SUFFIX = "[0-9A-Za-z_-]+";

export const NODE_ID_PATTERN = `^(?:${NODE_TYPES.join("|")})-${NODE_ID_SUFFIX}$`;
export const NodeIdSchema = z.string().regex(new RegExp(NODE_ID_PATTERN));
export const NodeTypeSchema = z.enum(NODE_TYPES);
export const ProvenanceTypeSchema = z.enum(PROVENANCE_TYPES);

const CommonNodeSchema = z
  .object({
    provenance_type: ProvenanceTypeSchema,
    statement: z.string().min(1),
    confidence_level: z.number().min(0).max(1).optional(),
    dependencies: z.array(NodeIdSchema).optional(),
    falsification_conditions: z.array(z.string()).optional(),
    status: z.string().optional(),
  })
  .passthrough();

const createNodeSchema = <T extends NodeType>(type: T) =>
  CommonNodeSchema.extend({
    id: z.string().regex(new RegExp(`^${type}-${NODE_ID_SUFFIX}$`)),
    type: z.literal(type),
  });

export const TaskNodeSchema = createNodeSchema("TASK");
export const FrameNodeSchema = createNodeSchema("FRAME");
export const ObservationNodeSchema = createNodeSchema("OBS");
export const HypothesisNodeSchema = createNodeSchema("HYP");
export const ContradictionNodeSchema = createNodeSchema("CTR");
export const TransformationNodeSchema = createNodeSchema("TRF");
export const SolutionSpaceNodeSchema = createNodeSchema("SPACE");
export const CandidateNodeSchema = createNodeSchema("CAN");
export const UnknownNodeSchema = createNodeSchema("UNK");
export const AssumptionNodeSchema = createNodeSchema("ASM");
export const DependencyNodeSchema = createNodeSchema("DEP");
export const DynamicsNodeSchema = createNodeSchema("DYN");
export const ValueSelectionNodeSchema = createNodeSchema("VAL-SELECT");
export const EvidenceRequestNodeSchema = createNodeSchema("EVDREQ");
export const EvidenceNodeSchema = createNodeSchema("EVD");
export const ValidationNodeSchema = createNodeSchema("VAL");
export const TransitionNodeSchema = createNodeSchema("TRANS");
export const DecisionNodeSchema = createNodeSchema("DEC");
export const StateNodeSchema = createNodeSchema("STATE");
export const HandoffNodeSchema = createNodeSchema("HANDOFF");
export const LeanTaskNodeSchema = createNodeSchema("LEAN-TASK");

export const NodeSchemas = {
  TASK: TaskNodeSchema,
  FRAME: FrameNodeSchema,
  OBS: ObservationNodeSchema,
  HYP: HypothesisNodeSchema,
  CTR: ContradictionNodeSchema,
  TRF: TransformationNodeSchema,
  SPACE: SolutionSpaceNodeSchema,
  CAN: CandidateNodeSchema,
  UNK: UnknownNodeSchema,
  ASM: AssumptionNodeSchema,
  DEP: DependencyNodeSchema,
  DYN: DynamicsNodeSchema,
  "VAL-SELECT": ValueSelectionNodeSchema,
  EVDREQ: EvidenceRequestNodeSchema,
  EVD: EvidenceNodeSchema,
  VAL: ValidationNodeSchema,
  TRANS: TransitionNodeSchema,
  DEC: DecisionNodeSchema,
  STATE: StateNodeSchema,
  HANDOFF: HandoffNodeSchema,
  "LEAN-TASK": LeanTaskNodeSchema,
} as const;

export const NodeSchema = z.discriminatedUnion("type", [
  TaskNodeSchema,
  FrameNodeSchema,
  ObservationNodeSchema,
  HypothesisNodeSchema,
  ContradictionNodeSchema,
  TransformationNodeSchema,
  SolutionSpaceNodeSchema,
  CandidateNodeSchema,
  UnknownNodeSchema,
  AssumptionNodeSchema,
  DependencyNodeSchema,
  DynamicsNodeSchema,
  ValueSelectionNodeSchema,
  EvidenceRequestNodeSchema,
  EvidenceNodeSchema,
  ValidationNodeSchema,
  TransitionNodeSchema,
  DecisionNodeSchema,
  StateNodeSchema,
  HandoffNodeSchema,
  LeanTaskNodeSchema,
]);

export type Node = z.infer<typeof NodeSchema>;
