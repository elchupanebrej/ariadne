import { z } from "zod";
import {
  EdgeSchema,
  type EpistemicEdge,
} from "../core/schemas/edges.js";
import {
  NodeSchema,
  type Node,
} from "../core/schemas/nodes.js";
import type { ProvenanceType } from "../core/types/nodes.js";

export type MaterializedGraph = {
  nodes: Node[];
  edges: EpistemicEdge[];
};

export const GraphEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), node: NodeSchema }),
  z.object({
    kind: z.literal("edge"),
    edge: EdgeSchema,
    tombstone: z.literal(true).optional(),
  }),
]);

export type GraphEvent = z.infer<typeof GraphEventSchema>;

/**
 * Validates one payload recovered from GRAPH.jsonl and normalizes the legacy
 * node/edge payload shape still understood by the migration boundary.
 */
export const parseGraphEventPayload = (payload: unknown): GraphEvent | undefined => {
  const event = GraphEventSchema.safeParse(payload);
  if (event.success) return event.data;

  const node = NodeSchema.safeParse(payload);
  if (node.success) return { kind: "node", node: node.data };

  const edge = EdgeSchema.safeParse(payload);
  if (edge.success) return { kind: "edge", edge: edge.data };

  return undefined;
};

const StateIdSchema = z.string().regex(/^[A-Z][A-Z0-9-]*-[0-9A-Za-z_-]+$/u);
const StateReferenceSchema = z.union([
  StateIdSchema,
  z.object({ id: StateIdSchema }).passthrough(),
]);

/**
 * STATE.yaml is JSON-compatible by design, with a strict Ariadne-owned core
 * and passthrough fields for host/GSD overlay metadata.
 */
export const StateSchema = z
  .object({
    schema_version: z.number().int().positive().optional(),
    mode: z.enum(["standalone", "gsd"]).optional(),
    depth_mode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    active_depth_mode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    depthMode: z.enum(["Fast", "Standard", "Deep"]).optional(),
    frontier: z.array(StateReferenceSchema).optional(),
    active_frontier: z.array(StateReferenceSchema).optional(),
    open_unknowns: z.array(StateReferenceSchema).optional(),
    openUnknowns: z.array(StateReferenceSchema).optional(),
    unknowns: z.array(StateReferenceSchema).optional(),
    active_notices: z.array(z.string().regex(/^NOT-[0-9A-Za-z_-]+$/u)).optional(),
    last_invalidation: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type AriadneState = z.infer<typeof StateSchema>;

export const edgeKey = (edge: Pick<EpistemicEdge, "source" | "type" | "target">): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

export const applyEvents = (
  graph: MaterializedGraph,
  events: readonly GraphEvent[],
): MaterializedGraph => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));

  for (const event of events) {
    if (event.kind === "node") nodes.set(event.node.id, event.node);
    else if (event.tombstone) edges.delete(edgeKey(event.edge));
    else edges.set(edgeKey(event.edge), event.edge);
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) =>
      edgeKey(left).localeCompare(edgeKey(right)),
    ),
  };
};

const compact = (value: string, limit = 100): string => {
  const oneLine = value.replace(/\s+/g, " ").replaceAll("|", "\\|").trim();
  return oneLine.length > limit ? `${oneLine.slice(0, limit - 1)}…` : oneLine;
};

export const TERMINAL_NODE_STATUSES = new Set([
  "RESOLVED",
  "REJECTED",
  "INVALIDATED",
  "REMOVED",
  "DECIDED",
  "WAIVED",
  "SUPERSEDED",
]);

export const isTerminalNode = (
  node: {
    provenance_type: ProvenanceType;
    status?: string;
    tombstone?: boolean;
    resolved_by?: string;
    waived_by?: string;
    superseded_by?: string;
  },
): boolean => {
  if (node.tombstone) return true;
  const normalizedStatus =
    typeof node.status === "string"
      ? node.status.toUpperCase().replaceAll("-", "_")
      : undefined;
  if (normalizedStatus === "RE_OPENED") return false;
  if (node.provenance_type === "DECIDED") return true;
  if (
    normalizedStatus !== undefined &&
    TERMINAL_NODE_STATUSES.has(normalizedStatus)
  ) {
    return true;
  }
  if (
    node.resolved_by !== undefined ||
    node.waived_by !== undefined ||
    node.superseded_by !== undefined
  ) {
    return true;
  }
  return false;
};

export const isFrontierNode = (
  node: { provenance_type: ProvenanceType; status?: string; tombstone?: boolean },
): boolean => !isTerminalNode(node);

export const stateForGraph = (
  state: Record<string, unknown>,
  graph: MaterializedGraph,
): Record<string, unknown> => {
  const frontierNodes = graph.nodes.filter(isFrontierNode);
  const frontier = frontierNodes.map((node) => node.id);
  const openUnknowns = frontierNodes
    .filter((node) => node.type === "UNK")
    .map((node) => node.id);
  const next: Record<string, unknown> = { ...state, frontier, open_unknowns: openUnknowns };
  if ("active_frontier" in state) next.active_frontier = frontier;
  if ("openUnknowns" in state) next.openUnknowns = openUnknowns;
  if ("unknowns" in state) next.unknowns = openUnknowns;
  return next;
};

export function renderIndex(graph: MaterializedGraph): string {
  const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const frontierNodes = nodes.filter(isFrontierNode);
  const activeNodes = nodes.filter(
    (node) => node.status !== "INVALIDATED" && node.status !== "REMOVED",
  );
  const unknowns = nodes.filter((node) => node.type === "UNK");
  const candidates = nodes.filter((node) => node.type === "CAN");
  const limit = 25;
  const renderedFrontier = frontierNodes.slice(0, limit);
  const omitted = frontierNodes.length - renderedFrontier.length;
  const rows = renderedFrontier.map(
    (node) =>
      `| ${node.id} | ${node.provenance_type} | ${node.status ?? "ACTIVE"} | ${compact(node.statement)} |`,
  );

  const lines = [
    "# Ariadne Epistemic Index",
    "",
    `Nodes: ${nodes.length} · Edges: ${graph.edges.length} · Active: ${activeNodes.length}`,
    `Unknowns: ${unknowns.length} · Candidates: ${candidates.length}`,
    "",
    "## Frontier",
    "",
    "| ID | Provenance | Status | Statement |",
    "| --- | --- | --- | --- |",
    ...(rows.length > 0 ? rows : ["| — | — | — | No active nodes |"]),
    "",
  ];

  if (omitted > 0) {
    lines.push(`*Omitted ${omitted} additional frontier nodes for compactness.*`, "");
  }

  return lines.join("\n");
}

const CARD_HEADER_FIELDS = new Set([
  "id",
  "type",
  "provenance_type",
  "statement",
  "title",
  "status",
  "tombstone",
]);

export function renderCard(node: Node): string {
  const status = node.status ?? "ACTIVE";
  const payload: Record<string, unknown> = Object.fromEntries(
    Object.entries(node).filter(([key]) => !CARD_HEADER_FIELDS.has(key)),
  );
  const payloadLines =
    Object.keys(payload).length > 0
      ? [
          "",
          "## Payload",
          "",
          "```json",
          JSON.stringify(payload, null, 2),
          "```",
          "",
        ]
      : [""];

  return [
    `# ${node.id}${node.title ? `: ${node.title}` : ""}`,
    "",
    `- Status: ${status}`,
    `- Provenance: ${node.provenance_type}`,
    `- Type: ${node.type}`,
    `- Revised: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Statement",
    "",
    node.statement,
    ...payloadLines,
  ].join("\n");
}
