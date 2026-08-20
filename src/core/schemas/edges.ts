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
    if (type !== "falsifies") return;

    if (sourceType(edge.source) !== "EVD" && sourceType(edge.source) !== "VAL") {
      context.addIssue({
        code: "custom",
        path: ["source"],
        message: "falsifies edges must originate from EVD or VAL nodes",
      });
    }

    const target = sourceType(edge.target);
    if (target !== "HYP" && target !== "ASM" && target !== "CAN") {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "falsifies edges must target HYP, ASM, or CAN nodes",
      });
    }
  });

export type EpistemicEdge = z.infer<typeof EdgeSchema>;
export type { Edge };
export type { ProvenanceType };
