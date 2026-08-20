import { type EdgeType, type EpistemicEdge } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";
import {
  validateGraph,
  type GraphDiagnostic,
} from "./integrity.js";
import type { MaterializedGraph } from "./storage.js";

export type InvalidationGraph = MaterializedGraph;

export type InvalidationTraceEntry = {
  node_id: string;
  status?: string;
  previous_status?: string;
  relation?: EdgeType;
};

export type InvalidationResult = {
  graph: InvalidationGraph;
  trace: InvalidationTraceEntry[];
  falsified_node_id: string;
  evidence_id: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const nodeKind = (node: Node): string =>
  node.id.slice(0, node.id.indexOf("-"));

const statusFor = (node: Node, rootId: string): string | undefined => {
  if (node.id === rootId) return "FALSIFIED";

  switch (nodeKind(node)) {
    case "CAN":
      return "INVALIDATED";
    case "CLM":
    case "DEC":
      return "NEEDS_REVIEW";
    case "TRANS":
      return "BLOCKED";
    default:
      return undefined;
  }
};

const validationError = (diagnostics: GraphDiagnostic[]): Error =>
  new Error(
    `Cannot invalidate invalid graph: ${diagnostics
      .map(({ message }) => message)
      .join("; ")}`,
  );

const invalidationMetadata = (
  node: Node,
  evidenceId: string,
  status: string,
): { metadata: Record<string, unknown>; previous?: string } => {
  const existing = isRecord(node.invalidation) ? node.invalidation : undefined;
  if (existing?.evidence_id === evidenceId) {
    return {
      metadata: existing,
      previous:
        typeof existing.previous_status === "string"
          ? existing.previous_status
          : undefined,
    };
  }

  return {
    metadata: {
      evidence_id: evidenceId,
      previous_status: node.status,
      status,
      ...(nodeKind(node) === "DEC" ? { reopened: true } : {}),
    },
    previous: node.status,
  };
};

const reverseTopology = (edges: readonly EpistemicEdge[]) => {
  const adjacency = new Map<string, Array<{ id: string; relation: EdgeType }>>();
  const add = (from: string, id: string, relation: EdgeType): void => {
    const neighbors = adjacency.get(from) ?? [];
    neighbors.push({ id, relation });
    adjacency.set(from, neighbors);
  };

  for (const edge of edges) {
    if (edge.type === "depends_on" || edge.type === "derived_from") {
      add(edge.target, edge.source, edge.type);
    } else if (edge.type === "supports") {
      add(edge.source, edge.target, edge.type);
    }
  }

  for (const neighbors of adjacency.values()) {
    neighbors.sort((left, right) =>
      `${left.id}\u0000${left.relation}`.localeCompare(
        `${right.id}\u0000${right.relation}`,
      ),
    );
  }
  return adjacency;
};

export function propagateInvalidation(
  graph: InvalidationGraph,
  falsifiedNodeId: string,
  evidenceId: string,
): InvalidationResult {
  const validation = validateGraph(graph);
  if (!validation.valid) throw validationError(validation.diagnostics);

  const evidence = graph.nodes.find(({ id }) => id === evidenceId);
  if (!evidence || evidence.type !== "EVD") {
    throw new Error(`Evidence ${evidenceId} must be an EVD node`);
  }
  if (evidence.provenance_type !== "MEASURED" && evidence.provenance_type !== "FACT") {
    throw new Error("Invalidation evidence must have MEASURED or FACT provenance");
  }

  const falsifiedNode = graph.nodes.find(({ id }) => id === falsifiedNodeId);
  if (!falsifiedNode || !["ASM", "HYP"].includes(nodeKind(falsifiedNode))) {
    throw new Error("Only ASM or HYP nodes can be falsified");
  }

  const falsificationEdge = graph.edges.some(
    (edge) =>
      edge.source === evidenceId &&
      edge.target === falsifiedNodeId &&
      edge.type === "falsifies",
  );
  if (!falsificationEdge) {
    throw new Error(`Evidence ${evidenceId} does not falsify ${falsifiedNodeId}`);
  }

  const nodes = graph.nodes.map((node) => ({ ...node }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = reverseTopology(graph.edges);
  const queue: Array<{ id: string; relation?: EdgeType }> = [
    { id: falsifiedNodeId },
  ];
  const visited = new Set<string>();
  const trace: InvalidationTraceEntry[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;
    visited.add(current.id);

    const node = nodeById.get(current.id);
    if (!node) continue;

    const nextStatus = statusFor(node, falsifiedNodeId);
    if (nextStatus) {
      const update = invalidationMetadata(node, evidenceId, nextStatus);
      node.status = nextStatus;
      node.invalidation = update.metadata;
      trace.push({
        node_id: node.id,
        status: node.status,
        previous_status: update.previous,
        relation: current.relation,
      });
    } else {
      trace.push({
        node_id: node.id,
        status: node.status,
        relation: current.relation,
      });
    }

    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (!visited.has(neighbor.id)) queue.push(neighbor);
    }
  }

  return {
    graph: { nodes, edges: [...graph.edges] },
    trace,
    falsified_node_id: falsifiedNodeId,
    evidence_id: evidenceId,
  };
}
