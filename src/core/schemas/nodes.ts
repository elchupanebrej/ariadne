import { z } from "zod";
import {
  NODE_TYPES,
  PROVENANCE_TYPES,
  TRANSITION_LIFECYCLE,
  type NodeType,
} from "../types/nodes.js";

export {
  NODE_TYPES,
  PROVENANCE_TYPES,
  TRANSITION_LIFECYCLE,
} from "../types/nodes.js";
export type {
  NodeType,
  ProvenanceType,
  TransitionLifecycle,
  NodeId,
  UnknownNode,
} from "../types/nodes.js";

const NODE_ID_SUFFIX = "[0-9A-Za-z_-]+";

export const NODE_ID_PATTERN = `^(?:${NODE_TYPES.join("|")})-${NODE_ID_SUFFIX}$`;
export const NodeIdSchema = z.string().regex(new RegExp(NODE_ID_PATTERN));
export const NodeTypeSchema = z.enum(NODE_TYPES);
export const ProvenanceTypeSchema = z.enum(PROVENANCE_TYPES);
export const TransitionLifecycleSchema = z.enum(TRANSITION_LIFECYCLE);

const CommonNodeSchema = z
  .object({
    provenance_type: ProvenanceTypeSchema,
    statement: z.string().min(1),
    confidence_level: z.number().min(0).max(1).optional(),
    dependencies: z.array(NodeIdSchema).optional(),
    falsification_conditions: z.array(z.string()).optional(),
    status: z.string().optional(),
    title: z.string().min(1).optional(),
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
export const ClaimNodeSchema = createNodeSchema("CLM").extend({
  claim_class: z.string().min(1).optional(),
});
export const HypothesisNodeSchema = createNodeSchema("HYP");
export const ContradictionNodeSchema = createNodeSchema("CTR");
export const TransformationNodeSchema = createNodeSchema("TRF");
export const SolutionSpaceNodeSchema = createNodeSchema("SPACE");
export const CandidateNodeSchema = createNodeSchema("CAN");
export const UnknownNodeSchema = createNodeSchema("UNK").extend({
  waived_by: z.string().min(1).optional(),
  resolved_by: z.string().min(1).optional(),
});
export const AssumptionNodeSchema = createNodeSchema("ASM");
export const DependencyNodeSchema = createNodeSchema("DEP");
export const DynamicsNodeSchema = createNodeSchema("DYN");
export const ValueSelectionNodeSchema = createNodeSchema("VAL-SELECT");
const RungSchema = z.union([
  z.number().int().min(1).max(10),
  z.string().regex(/^rung\s+(?:10|[1-9])$/iu),
]);
const ReceiptSchema = z.union([
  z.string().min(1),
  z.record(z.string(), z.unknown()),
]);

export const EvidenceRequestNodeSchema = createNodeSchema("EVDREQ").extend({
  claim: NodeIdSchema.optional(),
  candidate: NodeIdSchema.optional(),
  claim_class: z.string().min(1).optional(),
  minimum_rung: RungSchema.optional(),
  required_rung: RungSchema.optional(),
  pass_condition: z.string().min(1).optional(),
  fail_condition: z.string().min(1).optional(),
  providers: z.array(z.string().min(1)).optional(),
});
export const EvidenceNodeSchema = createNodeSchema("EVD").extend({
  verdict: z.enum(["SUPPORTED", "FALSIFIED", "INCONCLUSIVE"]).optional(),
  method: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  rung: RungSchema.optional(),
  evidentiary_rung: RungSchema.optional(),
  receipt: ReceiptSchema.optional(),
  environment: z.string().min(1).optional(),
  reproducible_environment: z.string().min(1).optional(),
  stdout_digest: z.string().min(1).optional(),
  telemetry_reference: z.string().min(1).optional(),
});
export const ValidationNodeSchema = createNodeSchema("VAL");
export const TransitionNodeSchema = createNodeSchema("TRANS")
  .extend({
    target_mechanism_ref: z.string().regex(/^CAN-[0-9A-Za-z_-]+$/),
    retirement_predicate: z.string().min(1),
    expiration_deadline: z
      .string()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "expiration_deadline must be a parseable date",
      }),
    cleanup_verification_test: z.string().min(1),
    owner: z.string().min(1),
    lifecycle_state: TransitionLifecycleSchema.optional(),
    transition_lifecycle: TransitionLifecycleSchema.optional(),
    lifecycle: TransitionLifecycleSchema.optional(),
    transition_receipt: ReceiptSchema.optional(),
    cleanup_verification_receipt: ReceiptSchema.optional(),
    verification_receipt: ReceiptSchema.optional(),
    verified: z.boolean().optional(),
  })
  .superRefine((node, context) => {
    const lifecycleValues = [
      node.lifecycle_state,
      node.transition_lifecycle,
      node.lifecycle,
    ].filter((value): value is (typeof TRANSITION_LIFECYCLE)[number] => value !== undefined);

    if (
      lifecycleValues.length === 0 &&
      !TRANSITION_LIFECYCLE.includes(node.status as (typeof TRANSITION_LIFECYCLE)[number])
    ) {
      context.addIssue({
        code: "custom",
        path: ["lifecycle_state"],
        message: "TRANS nodes must declare one of the six lifecycle states",
      });
    }

    if (new Set(lifecycleValues).size > 1) {
      context.addIssue({
        code: "custom",
        path: ["lifecycle_state"],
        message: "TRANS lifecycle fields must agree when more than one is provided",
      });
    }
  });
export const DecisionNodeSchema = createNodeSchema("DEC").extend({
  decision_scope: z.string().min(1).optional(),
});
export const StateNodeSchema = createNodeSchema("STATE");
export const HandoffNodeSchema = createNodeSchema("HANDOFF");
export const LeanTaskNodeSchema = createNodeSchema("LEAN-TASK");

export const NodeSchemas = {
  TASK: TaskNodeSchema,
  FRAME: FrameNodeSchema,
  OBS: ObservationNodeSchema,
  CLM: ClaimNodeSchema,
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
  ClaimNodeSchema,
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
