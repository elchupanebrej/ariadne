import { z } from "zod";
import { NODE_TYPES, NodeIdSchema } from "./nodes.js";
import type { NodeType } from "../types/nodes.js";
import {
  PROVENANCE_TYPES,
  type ProvenanceType,
} from "../types/provenance.js";

export const EDGE_TYPES = [
  "supports",
  "contradicts",
  "depends_on",
  "derived_from",
  "answers",
  "tests",
  "falsifies",
  "invalidates",
  "satisfies",
  "violates",
  "supersedes",
  "references",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];
export const EdgeTypeSchema = z.enum(EDGE_TYPES);
export const EdgeRelationSchema = EdgeTypeSchema;
export const ProvenanceSchema = z.enum(PROVENANCE_TYPES);

type Edge = {
  source: string;
  target: string;
  type: EdgeType;
};

const sourceType = (id: string): NodeType | undefined =>
  NODE_TYPES.find((type) => id.startsWith(`${type}-`));

const hasType = (id: string, types: readonly NodeType[]): boolean =>
  types.includes(sourceType(id) as NodeType);

const endpointIssue = (
  context: z.RefinementCtx,
  path: "source" | "target",
  message: string,
): void => context.addIssue({ code: "custom", path: [path], message });

const TypeEdgeSchema = z.object({
  source: NodeIdSchema,
  target: NodeIdSchema,
  type: EdgeTypeSchema,
});

const RelationEdgeSchema = z.object({
  source: NodeIdSchema,
  target: NodeIdSchema,
  relation: EdgeTypeSchema,
}).transform(({ source, target, relation }) => ({
  source,
  target,
  type: relation,
}));

export const EdgeSchema = z
  .union([TypeEdgeSchema, RelationEdgeSchema])
  .superRefine((edge, context) => {
    const type = edge.type;
    if (edge.source === edge.target) {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "Epistemic relations cannot target the source node itself",
      });
      return;
    }

    switch (type) {
      case "falsifies":
        if (!hasType(edge.source, ["EVD", "VAL"])) {
          endpointIssue(
            context,
            "source",
            "falsifies edges must originate from EVD or VAL nodes",
          );
        }
        if (!hasType(edge.target, ["HYP", "ASM", "CAN"])) {
          endpointIssue(
            context,
            "target",
            "falsifies edges must target HYP, ASM, or CAN nodes",
          );
        }
        break;
      case "answers":
        if (!hasType(edge.source, ["EVD"])) {
          endpointIssue(context, "source", "answers edges must originate from EVD nodes");
        }
        if (!hasType(edge.target, ["EVDREQ"])) {
          endpointIssue(context, "target", "answers edges must target EVDREQ nodes");
        }
        break;
      case "tests":
        if (!hasType(edge.source, ["EVD", "VAL", "EVDREQ"])) {
          endpointIssue(
            context,
            "source",
            "tests edges must originate from EVD, VAL, or EVDREQ nodes",
          );
        }
        if (!hasType(edge.target, ["CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"])) {
          endpointIssue(
            context,
            "target",
            "tests edges must target a proposition, candidate, transition, or evidence request",
          );
        }
        break;
      default:
        break;
    }
  });

export type EpistemicEdge = z.infer<typeof EdgeSchema>;
export type { Edge };
export type { ProvenanceType };
