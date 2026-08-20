import type { Node } from "../core/schemas/nodes.js";
import { validateGraph } from "../graph/integrity.js";
import type { MaterializedGraph } from "../graph/storage.js";

export const MINIMUM_EVIDENTIARY_RUNG = {
  "Syntactic structure": 2,
  "Algorithmic logic": 3,
  "Test suite quality": 5,
  "Boundary contract": 6,
  "Throughput & Latency": 7,
  "Distributed safety": 8,
  "Migration safety": 9,
  "Sustained reliability": 10,
} as const;

export type ClaimClass = keyof typeof MINIMUM_EVIDENTIARY_RUNG;

export type EpistemicDiagnosticCode =
  | "INVALID_GRAPH"
  | "UNKNOWN_CLAIM_CLASS"
  | "MISSING_EVIDENCE_RUNG"
  | "INSUFFICIENT_EVIDENCE"
  | "UNRESOLVED_DECISION_DEPENDENCY"
  | "MISSING_ADVERSARIAL_CRITIQUE";

export type EpistemicDiagnostic = {
  code: EpistemicDiagnosticCode;
  message: string;
  nodeId?: string;
  requestId?: string;
  evidenceId?: string;
  dependencyId?: string;
  claimClass?: string;
  required?: number;
  actual?: number;
};

export type EpistemicGateResult = {
  passed: boolean;
  diagnostics: EpistemicDiagnostic[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const text = (...values: unknown[]): string | undefined =>
  values.find((value): value is string => typeof value === "string" && value.trim() !== "");

const rung = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const match = value.match(/\b(?:rung\s*)?(10|[1-9])\b/i);
  return match ? Number(match[1]) : undefined;
};

const explicitRung = (node: Node): number | undefined =>
  rung(node.rung ?? node.evidentiary_rung ?? node.required_rung ?? node.minimum_rung);

const claimClass = (value: unknown): ClaimClass | undefined => {
  if (typeof value !== "string") return undefined;
  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, ClaimClass> = {
    syntacticstructure: "Syntactic structure",
    algorithmiclogic: "Algorithmic logic",
    functionalbehavior: "Algorithmic logic",
    testsuitequality: "Test suite quality",
    boundarycontract: "Boundary contract",
    throughputlatency: "Throughput & Latency",
    throughputcapacity: "Throughput & Latency",
    resourcebound: "Throughput & Latency",
    distributedsafety: "Distributed safety",
    concurrencyinvariance: "Distributed safety",
    faultresilience: "Distributed safety",
    migrationsafety: "Migration safety",
    schemaevolution: "Migration safety",
    sustainedreliability: "Sustained reliability",
  };
  return aliases[key];
};

const claimClassOf = (node: Node): string | undefined =>
  text(node.claim_class, node.claimClass, node.claim_type, node.claimType);

const critiquePresent = (node: Node): boolean => {
  const value =
    node.adversarial_critique ??
    node.adversarialCritique ??
    node.adversarial_review ??
    node.adversarialReview;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((entry) => critiqueValue(entry));
  return isRecord(value) && Object.values(value).some((entry) => critiqueValue(entry));
};

const critiqueValue = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((entry) => critiqueValue(entry));
  return isRecord(value) && Object.values(value).some((entry) => critiqueValue(entry));
};

const locked = (node: Node): boolean =>
  node.provenance_type === "DECIDED" || node.status?.toUpperCase() === "DECIDED";

const linkedEvidenceIds = (
  request: Node,
  evidence: Node[],
  edges: MaterializedGraph["edges"],
): string[] => {
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.type !== "answers") continue;
    if (edge.target === request.id) ids.add(edge.source);
    if (edge.source === request.id) ids.add(edge.target);
  }

  for (const candidate of evidence) {
    const linked = [
      candidate.evidence_request_id,
      candidate.evidenceRequestId,
      candidate.request_id,
      candidate.requestId,
    ];
    if (linked.includes(request.id)) ids.add(candidate.id);
  }
  return [...ids].filter((id) => evidence.some((candidate) => candidate.id === id)).sort();
};

const decisionDependencies = (
  decision: Node,
  nodes: Map<string, Node>,
  edges: MaterializedGraph["edges"],
): Node[] => {
  const adjacency = new Map<string, string[]>();
  const add = (source: string, target: string): void => {
    const targets = adjacency.get(source) ?? [];
    targets.push(target);
    adjacency.set(source, targets);
  };

  for (const edge of edges) {
    if (
      (edge.type === "depends_on" || edge.type === "derived_from") &&
      nodes.has(edge.source) &&
      nodes.has(edge.target)
    ) {
      add(edge.source, edge.target);
    }
  }
  for (const dependency of Array.isArray(decision.dependencies) ? decision.dependencies : []) {
    if (typeof dependency === "string" && nodes.has(dependency)) add(decision.id, dependency);
  }

  const queue = [...(adjacency.get(decision.id) ?? [])].sort();
  const visited = new Set<string>();
  const result: Node[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const dependency = nodes.get(id);
    if (dependency) result.push(dependency);
    queue.push(...(adjacency.get(id) ?? []).sort());
  }
  return result;
};

export function runEpistemicGate(input: unknown): EpistemicGateResult {
  const validation = validateGraph(input);
  if (!validation.valid) {
    return {
      passed: false,
      diagnostics: validation.diagnostics.map(({ message, nodeId }) => ({
        code: "INVALID_GRAPH",
        message,
        nodeId,
      })),
    };
  }

  const graph = input as MaterializedGraph;
  const diagnostics: EpistemicDiagnostic[] = [];
  const evidence = graph.nodes.filter((node) => node.type === "EVD");
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const request of graph.nodes.filter((node) => node.type === "EVDREQ")) {
    const rawClass = claimClassOf(request);
    const normalizedClass = claimClass(rawClass);
    const required = explicitRung(request) ??
      (normalizedClass ? MINIMUM_EVIDENTIARY_RUNG[normalizedClass] : undefined);
    if (required === undefined) {
      diagnostics.push({
        code: "UNKNOWN_CLAIM_CLASS",
        message: `Evidence request ${request.id} has no supported claim class or minimum rung`,
        nodeId: request.id,
        requestId: request.id,
        claimClass: rawClass,
      });
      continue;
    }

    for (const evidenceId of linkedEvidenceIds(request, evidence, graph.edges)) {
      const result = nodes.get(evidenceId);
      if (!result) continue;
      const actual = explicitRung(result);
      if (actual === undefined) {
        diagnostics.push({
          code: "MISSING_EVIDENCE_RUNG",
          message: `Evidence ${result.id} must declare an evidentiary rung`,
          nodeId: result.id,
          requestId: request.id,
          evidenceId: result.id,
          required,
        });
      } else if (actual < required) {
        diagnostics.push({
          code: "INSUFFICIENT_EVIDENCE",
          message: `Evidence ${result.id} is rung ${actual}; ${request.id} requires rung ${required}`,
          nodeId: result.id,
          requestId: request.id,
          evidenceId: result.id,
          claimClass: rawClass,
          required,
          actual,
        });
      }
    }
  }

  for (const node of graph.nodes.filter(
    (candidate) =>
      (candidate.type === "DEC" || candidate.type === "CAN") && locked(candidate),
  )) {
    if (!critiquePresent(node)) {
      diagnostics.push({
        code: "MISSING_ADVERSARIAL_CRITIQUE",
        message: `${node.id} cannot be locked without a non-empty adversarial critique`,
        nodeId: node.id,
      });
    }
  }

  for (const decision of graph.nodes.filter((node) => node.type === "DEC" && locked(node))) {
    for (const dependency of decisionDependencies(decision, nodes, graph.edges)) {
      if (dependency.provenance_type === "ASSUMED" || dependency.provenance_type === "UNKNOWN") {
        diagnostics.push({
          code: "UNRESOLVED_DECISION_DEPENDENCY",
          message: `${decision.id} depends on ${dependency.id} with ${dependency.provenance_type} provenance`,
          nodeId: decision.id,
          dependencyId: dependency.id,
        });
      }
    }
  }

  return { passed: diagnostics.length === 0, diagnostics };
}
