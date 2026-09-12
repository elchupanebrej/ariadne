import { type EdgeType, type EpistemicEdge } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";
import { AriadneError } from "../core/errors.js";
import {
  validateGraph,
  type GraphDiagnostic,
} from "./integrity.js";
import type { MaterializedGraph } from "./domain.js";
import { validateFalsifyingEvidence } from "../gates/epistemic-gate.js";

export type InvalidationGraph = MaterializedGraph;

export type InvalidationTraceEntry = {
  node_id: string;
  status?: string;
  previous_status?: string;
  relation?: EdgeType | "waived_by" | "superseded_by" | string;
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
      return "NEEDS_REVIEW";
    case "DEC":
      return "RE-OPENED";
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
      ...(nodeKind(node) === "DEC"
        ? { reopened: true, needs_review: true }
        : {}),
    },
    previous: node.status,
  };
};

export const buildInfluenceAdjacency = (
  graph: Pick<MaterializedGraph, "nodes" | "edges">,
  options: { includeDependencies?: boolean } = {},
) => {
  const adjacency = new Map<string, Array<{ id: string; relation: EdgeType }>>();
  const add = (from: string, id: string, relation: EdgeType): void => {
    const neighbors = adjacency.get(from) ?? [];
    neighbors.push({ id, relation });
    adjacency.set(from, neighbors);
  };

  for (const edge of graph.edges) {
    if (edge.type === "depends_on" || edge.type === "derived_from") {
      add(edge.target, edge.source, edge.type);
    } else if (edge.type === "supports") {
      add(edge.source, edge.target, edge.type);
    } else if (edge.type === "invalidates") {
      add(edge.source, edge.target, edge.type);
    }
  }

  if (options.includeDependencies) {
    for (const node of graph.nodes) {
      for (const dependency of node.dependencies ?? []) add(dependency, node.id, "depends_on");
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

const reverseTopology = (edges: readonly EpistemicEdge[]) =>
  buildInfluenceAdjacency({ nodes: [], edges: [...edges] });

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
  const evidenceIssues = validateFalsifyingEvidence(evidence);
  if (evidenceIssues.length > 0) {
    throw new Error(
      `Invalidation evidence is incomplete: ${evidenceIssues.join(", ")}`,
    );
  }

  const falsifiedNode = graph.nodes.find(({ id }) => id === falsifiedNodeId);
  if (!falsifiedNode) {
    throw new Error(`Node not found: ${falsifiedNodeId}`);
  }
  const kind = nodeKind(falsifiedNode);
  if (kind === "UNK" || falsifiedNode.type === "UNK") {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Cannot invalidate UNK node ${falsifiedNodeId}; unknowns are closed by decision via 'ariadne waive <UNK> --by <DEC>'. Use: ariadne waive ${falsifiedNodeId} --by <decision-id>`,
      repair: `ariadne waive ${falsifiedNodeId} --by <decision-id>`,
    });
  }
  if (kind === "DEC" || falsifiedNode.type === "DEC") {
    throw new AriadneError({
      code: "INVALID_INPUT",
      message: `Cannot invalidate DEC node ${falsifiedNodeId}; decisions are superseded by replacement decisions via 'ariadne supersede <DEC> --by <DEC>'. Use: ariadne supersede ${falsifiedNodeId} --by <decision-id>`,
      repair: `ariadne supersede ${falsifiedNodeId} --by <decision-id>`,
    });
  }
  if (!["ASM", "HYP"].includes(kind)) {
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

  let queueIndex = 0;
  while (queueIndex < queue.length) {
    const current = queue[queueIndex];
    queueIndex += 1;
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

  const reopenedDecQueue: string[] = [];
  for (const entry of trace) {
    const node = nodeById.get(entry.node_id);
    if (
      node &&
      (nodeKind(node) === "DEC" || node.type === "DEC") &&
      node.status === "RE-OPENED"
    ) {
      reopenedDecQueue.push(node.id);
    }
  }

  const processedDecIds = new Set<string>();
  let decQueueIndex = 0;
  while (decQueueIndex < reopenedDecQueue.length) {
    const decId = reopenedDecQueue[decQueueIndex];
    decQueueIndex += 1;
    if (processedDecIds.has(decId)) continue;
    processedDecIds.add(decId);

    const dependents = nodes
      .filter(
        (node) =>
          (node as unknown as { waived_by?: string }).waived_by === decId ||
          (node as unknown as { superseded_by?: string }).superseded_by === decId,
      )
      .sort((left, right) => left.id.localeCompare(right.id));

    for (const candidate of dependents) {
      if (visited.has(candidate.id)) continue;
      visited.add(candidate.id);

      const relation: InvalidationTraceEntry["relation"] =
        (candidate as unknown as { waived_by?: string }).waived_by === decId
          ? "waived_by"
          : "superseded_by";

      const existing = isRecord(candidate.invalidation)
        ? candidate.invalidation
        : undefined;

      let previousStatus = candidate.status;
      if (existing?.evidence_id === evidenceId) {
        previousStatus =
          typeof existing.previous_status === "string"
            ? existing.previous_status
            : undefined;
      } else {
        candidate.invalidation = {
          evidence_id: evidenceId,
          previous_status: candidate.status,
          status: "RE-OPENED",
          reopened_by_decision: decId,
          ...(nodeKind(candidate) === "DEC" || candidate.type === "DEC"
            ? { reopened: true, needs_review: true }
            : {}),
        };
        candidate.status = "RE-OPENED";
      }

      trace.push({
        node_id: candidate.id,
        status: candidate.status,
        previous_status: previousStatus,
        relation,
      });

      if (
        (nodeKind(candidate) === "DEC" || candidate.type === "DEC") &&
        !processedDecIds.has(candidate.id)
      ) {
        reopenedDecQueue.push(candidate.id);
      }
    }
  }

  return {
    graph: { nodes, edges: [...graph.edges] },
    trace,
    falsified_node_id: falsifiedNodeId,
    evidence_id: evidenceId,
  };
}
