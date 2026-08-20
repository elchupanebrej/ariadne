import { z } from "zod";
import {
  EdgeSchema,
  type EpistemicEdge,
} from "../core/schemas/edges.js";
import {
  NodeSchema,
  type Node,
} from "../core/schemas/nodes.js";

export type GraphDiagnosticCode =
  | "INVALID_GRAPH"
  | "INVALID_NODE"
  | "DUPLICATE_NODE"
  | "INVALID_EDGE"
  | "MISSING_NODE"
  | "CYCLE";

export type GraphDiagnostic = {
  code: GraphDiagnosticCode;
  message: string;
  nodeId?: string;
  edge?: {
    source?: string;
    target?: string;
    type?: string;
  };
  path?: string[];
  issues?: Array<{ path: (string | number)[]; message: string }>;
};

export type GraphValidationResult = {
  valid: boolean;
  diagnostics: GraphDiagnostic[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const rawId = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === "string" ? value.id : undefined;

const rawEdge = (value: unknown): GraphDiagnostic["edge"] => {
  if (!isRecord(value)) return undefined;
  return {
    source: typeof value.source === "string" ? value.source : undefined,
    target: typeof value.target === "string" ? value.target : undefined,
    type:
      typeof value.type === "string"
        ? value.type
        : typeof value.relation === "string"
          ? value.relation
          : undefined,
  };
};

const zodIssues = (
  error: z.ZodError,
): Array<{ path: (string | number)[]; message: string }> =>
  error.issues.map(({ path, message }) => ({
    path: path.map((segment) =>
      typeof segment === "string" || typeof segment === "number"
        ? segment
        : String(segment),
    ),
    message,
  }));

const isDeductiveEdge = (edge: EpistemicEdge): boolean =>
  edge.type === "depends_on" || edge.type === "derived_from";

/**
 * Validate graph schemas, references, and the deductive DAG invariant.
 *
 * The edge direction is source -> target, including for depends_on and
 * derived_from. Other relations are intentionally excluded from cycle checks.
 */
export function validateGraph(input: unknown): GraphValidationResult {
  const diagnostics: GraphDiagnostic[] = [];

  if (!isRecord(input) || !Array.isArray(input.nodes) || !Array.isArray(input.edges)) {
    return {
      valid: false,
      diagnostics: [
        {
          code: "INVALID_GRAPH",
          message: "Graph must contain nodes and edges arrays",
        },
      ],
    };
  }

  const nodes: Node[] = [];
  const nodeIds = new Set<string>();

  for (const value of input.nodes) {
    const parsed = NodeSchema.safeParse(value);
    if (!parsed.success) {
      diagnostics.push({
        code: "INVALID_NODE",
        message: "Node does not satisfy the canonical node schema",
        nodeId: rawId(value),
        issues: zodIssues(parsed.error),
      });
      continue;
    }

    if (nodeIds.has(parsed.data.id)) {
      diagnostics.push({
        code: "DUPLICATE_NODE",
        message: `Node id ${parsed.data.id} occurs more than once`,
        nodeId: parsed.data.id,
      });
      continue;
    }

    nodeIds.add(parsed.data.id);
    nodes.push(parsed.data);
  }

  const edges: EpistemicEdge[] = [];
  for (const value of input.edges) {
    const parsed = EdgeSchema.safeParse(value);
    if (!parsed.success) {
      diagnostics.push({
        code: "INVALID_EDGE",
        message: "Edge does not satisfy the canonical edge schema",
        edge: rawEdge(value),
        issues: zodIssues(parsed.error),
      });
      continue;
    }
    edges.push(parsed.data);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      diagnostics.push({
        code: "MISSING_NODE",
        message: `Edge source ${edge.source} does not exist`,
        nodeId: edge.source,
        edge,
      });
    }
    if (!nodeIds.has(edge.target)) {
      diagnostics.push({
        code: "MISSING_NODE",
        message: `Edge target ${edge.target} does not exist`,
        nodeId: edge.target,
        edge,
      });
    }
  }

  for (const node of nodes) {
    for (const dependency of node.dependencies ?? []) {
      if (nodeIds.has(dependency)) continue;
      diagnostics.push({
        code: "MISSING_NODE",
        message: `Node dependency ${dependency} referenced by ${node.id} does not exist`,
        nodeId: dependency,
      });
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!isDeductiveEdge(edge) || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }
    const neighbors = adjacency.get(edge.source) ?? [];
    if (!neighbors.includes(edge.target)) neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }
  for (const neighbors of adjacency.values()) neighbors.sort((left, right) => left.localeCompare(right));

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  let cycleReported = false;

  const visit = (id: string): void => {
    if (cycleReported) return;
    state.set(id, 1);
    stack.push(id);

    for (const neighbor of adjacency.get(id) ?? []) {
      if (cycleReported) break;
      const neighborState = state.get(neighbor) ?? 0;
      if (neighborState === 0) {
        visit(neighbor);
      } else if (neighborState === 1) {
        const start = stack.indexOf(neighbor);
        const path = [...stack.slice(start), neighbor];
        diagnostics.push({
          code: "CYCLE",
          message: `Deductive cycle detected: ${path.join(" -> ")}`,
          path,
        });
        cycleReported = true;
      }
    }

    stack.pop();
    state.set(id, 2);
  };

  for (const id of [...nodeIds].sort((left, right) => left.localeCompare(right))) {
    if ((state.get(id) ?? 0) === 0) visit(id);
    if (cycleReported) break;
  }

  return { valid: diagnostics.length === 0, diagnostics };
}

export const validateGraphIntegrity = validateGraph;
