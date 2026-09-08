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

// Formatting variants that are semantically identical to their canonical
// relation. Anything not listed here is rejected rather than silently
// downgraded.
const EDGE_RELATION_ALIASES: Readonly<Record<string, EdgeType>> = {
  "depends-on": "depends_on",
  dependsOn: "depends_on",
  "derived-from": "derived_from",
  derivedFrom: "derived_from",
};

export function canonicalEdgeRelation(raw: string): EdgeType | undefined {
  const key = raw.trim();
  if ((EDGE_TYPES as readonly string[]).includes(key)) return key as EdgeType;
  return EDGE_RELATION_ALIASES[key] ?? EDGE_RELATION_ALIASES[key.toLowerCase()];
}

export const EDGE_TYPE_LIST = EDGE_TYPES.join(", ");
const EDGE_RELATION_ALIAS_LIST = Object.keys(EDGE_RELATION_ALIASES).join(", ");
export const EDGE_TYPE_HINT =
  `Valid edge relations: ${EDGE_TYPE_LIST}; aliases: ${EDGE_RELATION_ALIAS_LIST}`;
export const unknownEdgeRelation = (value: string): string =>
  `Invalid edge relation: ${value}. ${EDGE_TYPE_HINT}`;

type Edge = {
  source: string;
  target: string;
  type: EdgeType;
};

const sourceType = (id: string): NodeType | undefined =>
  NODE_TYPES.find((type) => id.startsWith(`${type}-`));

const hasType = (id: string, types: readonly NodeType[]): boolean =>
  types.includes(sourceType(id) as NodeType);

const PROPOSITION_NODE_TYPES: readonly NodeType[] = [
  "TASK",
  "FRAME",
  "OBS",
  "CLM",
  "HYP",
  "CTR",
  "CAN",
  "ASM",
  "TRANS",
  "DEC",
  "TRF",
  "VAL-SELECT",
];
const EVIDENCE_NODE_TYPES: readonly NodeType[] = ["EVD", "VAL"];

type EndpointContract = {
  source: readonly NodeType[];
  target: readonly NodeType[];
};

const EDGE_ENDPOINT_CONTRACTS: Record<EdgeType, EndpointContract> = {
  supports: {
    source: [...PROPOSITION_NODE_TYPES, ...EVIDENCE_NODE_TYPES],
    target: PROPOSITION_NODE_TYPES,
  },
  contradicts: {
    source: PROPOSITION_NODE_TYPES,
    target: PROPOSITION_NODE_TYPES,
  },
  depends_on: {
    source: [...PROPOSITION_NODE_TYPES, "EVDREQ"],
    target: [...PROPOSITION_NODE_TYPES, "UNK"],
  },
  derived_from: {
    source: PROPOSITION_NODE_TYPES,
    target: [...PROPOSITION_NODE_TYPES, ...EVIDENCE_NODE_TYPES],
  },
  answers: {
    source: ["EVD"],
    target: ["EVDREQ"],
  },
  tests: {
    source: ["EVD", "VAL", "EVDREQ"],
    target: ["CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  falsifies: {
    source: ["EVD", "VAL"],
    target: ["HYP", "ASM", "CAN"],
  },
  invalidates: {
    source: PROPOSITION_NODE_TYPES,
    target: ["TASK", "CLM", "HYP", "ASM", "CAN", "TRANS", "DEC"],
  },
  satisfies: {
    source: ["EVD", "VAL", "CLM", "HYP", "CAN", "DEC", "TASK"],
    target: ["TASK", "FRAME", "CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  violates: {
    source: ["EVD", "VAL", "CLM", "HYP", "ASM", "CAN", "DEC", "TASK"],
    target: ["TASK", "FRAME", "CLM", "HYP", "ASM", "CAN", "CTR", "TRANS", "EVDREQ"],
  },
  supersedes: {
    source: NODE_TYPES,
    target: NODE_TYPES,
  },
  references: {
    source: NODE_TYPES,
    target: NODE_TYPES,
  },
};

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

    const contract = EDGE_ENDPOINT_CONTRACTS[type];
    if (!hasType(edge.source, contract.source)) {
      endpointIssue(context, "source", `${type} edges have an invalid source node type`);
    }
    if (!hasType(edge.target, contract.target)) {
      endpointIssue(context, "target", `${type} edges have an invalid target node type`);
    }
    if (type === "supersedes" && sourceType(edge.source) !== sourceType(edge.target)) {
      endpointIssue(context, "target", "supersedes edges must connect nodes of the same type");
    }
  });

export type EpistemicEdge = z.infer<typeof EdgeSchema>;
export type { Edge };
export type { ProvenanceType };
