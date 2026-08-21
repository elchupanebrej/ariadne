import type { Node } from "../core/schemas/nodes.js";

export type SemanticDiagnosticCode =
  | "INVALID_GRAPH"
  | "CTR_SEPARATION_PREFLIGHT"
  | "CTR_CANDIDATE_CARDINALITY"
  | "CTR_SEPARATION_DIVERSITY"
  | "HYP_FALSIFICATION_CONDITION"
  | "HARD_REQUIREMENT_FAILED";

export type SemanticDiagnostic = {
  code: SemanticDiagnosticCode;
  message: string;
  nodeId?: string;
  required?: number;
  actual?: number;
  candidates?: string[];
  requiredCandidates?: number;
  actualCandidates?: number;
  coveredPrinciples?: string[];
  uncoveredPrinciples?: string[];
  additionalCandidatesNeeded?: number;
  additionalPrinciplesNeeded?: number;
};

export type SemanticGateResult = {
  passed: boolean;
  diagnostics: SemanticDiagnostic[];
};

type SemanticNode = Node & Record<string, unknown>;
type SemanticEdge = {
  source: string;
  target: string;
  type?: string;
};

const CANONICAL_SEPARATION_PRINCIPLES = [
  "Time",
  "State/Data",
  "Operating Condition",
  "System Boundary",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asNodes = (value: unknown): SemanticNode[] | undefined => {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return undefined;
  const nodes = value.nodes.filter(
    (node): node is SemanticNode =>
      isRecord(node) && typeof node.id === "string" && typeof node.type === "string",
  );
  return nodes.length === value.nodes.length ? nodes : undefined;
};

const asEdges = (value: unknown): SemanticEdge[] | undefined => {
  if (!isRecord(value) || !Array.isArray(value.edges)) return undefined;
  const edges = value.edges.filter(
    (edge): edge is SemanticEdge =>
      isRecord(edge) &&
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      (edge.type === undefined || typeof edge.type === "string"),
  );
  return edges.length === value.edges.length ? edges : undefined;
};

const strings = (value: unknown): string[] => {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return entry.trim() ? [entry.trim()] : [];
    if (isRecord(entry) && typeof entry.id === "string") return [entry.id];
    return [];
  });
};

const references = (value: SemanticNode, nodeId: string): boolean =>
  [
    "contradiction_ref",
    "contradiction_id",
    "contradiction",
    "ctr_id",
    "dependencies",
  ].some((key) => strings(value[key]).includes(nodeId));

const isActive = (node: SemanticNode): boolean => {
  const status =
    typeof node.status === "string"
      ? node.status.toUpperCase().replaceAll("-", "_")
      : "ACTIVE";
  return ![
    "INVALIDATED",
    "FALSIFIED",
    "INACTIVE",
    "CLOSED",
    "RESOLVED",
    "RETIRED",
    "NEEDS_REVIEW",
    "RE_OPENED",
    "STALE",
    "REQUIRES_REVALUATION",
    "BLOCKED",
  ].includes(status);
};

const linkedToContradiction = (
  candidate: SemanticNode,
  contradiction: SemanticNode,
  edges: SemanticEdge[],
): boolean => {
  const candidateIds = new Set(
    ["candidate_ids", "candidates", "candidate_mechanisms"].flatMap((key) =>
      strings(contradiction[key]),
    ),
  );
  if (candidateIds.has(candidate.id) || references(candidate, contradiction.id)) return true;

  return edges.some(
    (edge) =>
      (edge.source === candidate.id && edge.target === contradiction.id) ||
      (edge.source === contradiction.id && edge.target === candidate.id),
  );
};

const hasCandidateAssociation = (
  candidates: SemanticNode[],
  contradictions: SemanticNode[],
  edges: SemanticEdge[],
): boolean =>
  contradictions.some((contradiction) =>
    candidates.some((candidate) => linkedToContradiction(candidate, contradiction, edges)),
  );

const relatedCandidatesFor = (
  candidates: SemanticNode[],
  contradictions: SemanticNode[],
  contradiction: SemanticNode,
  edges: SemanticEdge[],
): SemanticNode[] =>
  hasCandidateAssociation(candidates, contradictions, edges)
    ? candidates.filter((candidate) => linkedToContradiction(candidate, contradiction, edges))
    : candidates;

const separationPrinciples = (candidate: SemanticNode): string[] =>
  ["separation_principle", "separation_principles", "separationPrinciple"].flatMap((key) =>
    strings(candidate[key]),
  );

const hasFalsificationCondition = (hypothesis: SemanticNode): boolean =>
  ["falsification_conditions", "falsification_condition", "falsification_predicates"].some(
    (key) => strings(hypothesis[key]).length > 0,
  );

const requirementFailed = (value: unknown): boolean => {
  if (value === false) return true;
  if (!isRecord(value)) return false;

  for (const key of ["satisfied", "passed", "met", "valid"]) {
    if (value[key] === false) return true;
  }
  for (const key of ["status", "result", "outcome"]) {
    const status = value[key];
    if (typeof status === "string" && ["FAIL", "FAILED", "UNSATISFIED", "VIOLATED"].includes(status.toUpperCase())) {
      return true;
    }
  }
  return false;
};

const hasHardRequirementFailure = (node: SemanticNode): boolean => {
  if (
    node.hard_requirement_failed === true ||
    node.hard_requirements_failed === true ||
    node.hardRequirementFailed === true
  ) {
    return true;
  }

  const hardRequirements = node.hard_requirements ?? node.hardRequirements;
  if (Array.isArray(hardRequirements)) return hardRequirements.some(requirementFailed);
  if (isRecord(hardRequirements)) {
    return Object.values(hardRequirements).some(requirementFailed);
  }

  const requirements = node.requirements;
  return (
    Array.isArray(requirements) &&
    requirements.some(
      (requirement) => isRecord(requirement) && requirement.hard === true && requirementFailed(requirement),
    )
  );
};

const depthModeOf = (input: unknown): "Fast" | "Standard" | "Deep" => {
  if (!isRecord(input)) return "Standard";
  const value = input.depth_mode ?? input.depthMode ?? input.epistemic_mode ?? input.mode;
  if (typeof value !== "string") return "Standard";
  const normalized = value.toLowerCase();
  if (normalized === "fast") return "Fast";
  if (normalized === "deep") return "Deep";
  return "Standard";
};

const semanticContextFor = (input: unknown, nodes: SemanticNode[]) => ({
  requiredCandidates: depthModeOf(input) === "Fast" ? 1 : 3,
  candidates: nodes.filter((node) => node.type === "CAN" && isActive(node)),
  contradictions: nodes.filter((node) => node.type === "CTR" && isActive(node)),
});

const contradictionBreadthFor = (
  candidates: SemanticNode[],
  contradictions: SemanticNode[],
  contradiction: SemanticNode,
  edges: SemanticEdge[],
) => {
  const relatedCandidates = relatedCandidatesFor(
    candidates,
    contradictions,
    contradiction,
    edges,
  );
  const principles = [
    ...new Set(
      relatedCandidates
        .flatMap(separationPrinciples)
        .map((principle) => principle.toLocaleLowerCase()),
    ),
  ].sort();

  return { relatedCandidates, principles };
};

/** Explain missing contradiction breadth without changing the graph or gate result. */
export function runSemanticPreflight(input: unknown): SemanticDiagnostic[] {
  const nodes = asNodes(input);
  const edges = asEdges(input);
  if (!nodes || !edges) return [];

  const { requiredCandidates, candidates, contradictions } = semanticContextFor(input, nodes);

  return contradictions.flatMap((contradiction) => {
    const { relatedCandidates, principles } = contradictionBreadthFor(
      candidates,
      contradictions,
      contradiction,
      edges,
    );
    if (
      principles.length >= requiredCandidates &&
      relatedCandidates.length >= requiredCandidates
    ) {
      return [];
    }

    const uncoveredPrinciples = CANONICAL_SEPARATION_PRINCIPLES.filter(
      (principle) => !principles.includes(principle.toLocaleLowerCase()),
    );

    return [
      {
        code: "CTR_SEPARATION_PREFLIGHT",
        message:
          `Active contradiction ${contradiction.id} needs at least ${requiredCandidates} ` +
          `structurally distinct candidate mechanisms across separation principles; ` +
          `found ${relatedCandidates.length} candidate(s) covering ${principles.length}.`,
        nodeId: contradiction.id,
        required: requiredCandidates,
        actual: principles.length,
        candidates: relatedCandidates.map((candidate) => candidate.id).sort(),
        requiredCandidates,
        actualCandidates: relatedCandidates.length,
        coveredPrinciples: principles,
        uncoveredPrinciples,
        additionalCandidatesNeeded: Math.max(0, requiredCandidates - relatedCandidates.length),
        additionalPrinciplesNeeded: Math.max(0, requiredCandidates - principles.length),
      },
    ];
  });
}

/** Enforce deterministic contradiction, falsifiability, and hard-requirement rules. */
export function runSemanticGate(input: unknown): SemanticGateResult {
  const nodes = asNodes(input);
  const edges = asEdges(input);
  if (!nodes || !edges) {
    return {
      passed: false,
      diagnostics: [
        {
          code: "INVALID_GRAPH",
          message: "Semantic gate requires nodes and edges arrays with node identifiers",
        },
      ],
    };
  }

  const diagnostics: SemanticDiagnostic[] = [];
  const { requiredCandidates, candidates, contradictions } = semanticContextFor(input, nodes);

  for (const contradiction of contradictions) {
    const { relatedCandidates, principles } = contradictionBreadthFor(
      candidates,
      contradictions,
      contradiction,
      edges,
    );

    if (relatedCandidates.length < requiredCandidates) {
      diagnostics.push({
        code: "CTR_CANDIDATE_CARDINALITY",
        message: `Active contradiction ${contradiction.id} requires at least ${requiredCandidates} structurally distinct candidate mechanisms`,
        nodeId: contradiction.id,
        required: requiredCandidates,
        actual: relatedCandidates.length,
        candidates: relatedCandidates.map((candidate) => candidate.id).sort(),
      });
    }

    if (principles.length < requiredCandidates) {
      diagnostics.push({
        code: "CTR_SEPARATION_DIVERSITY",
        message: `Active contradiction ${contradiction.id} requires at least ${requiredCandidates} distinct separation principles`,
        nodeId: contradiction.id,
        required: requiredCandidates,
        actual: principles.length,
        candidates: relatedCandidates.map((candidate) => candidate.id).sort(),
      });
    }
  }

  for (const hypothesis of nodes.filter((node) => node.type === "HYP" && isActive(node))) {
    if (!hasFalsificationCondition(hypothesis)) {
      diagnostics.push({
        code: "HYP_FALSIFICATION_CONDITION",
        message: `Hypothesis ${hypothesis.id} must define a falsification condition`,
        nodeId: hypothesis.id,
      });
    }
  }

  for (const node of nodes) {
    if (hasHardRequirementFailure(node)) {
      diagnostics.push({
        code: "HARD_REQUIREMENT_FAILED",
        message: `Node ${node.id} has a failed hard requirement; weighted scores cannot compensate`,
        nodeId: node.id,
      });
    }
  }

  return { passed: diagnostics.length === 0, diagnostics };
}
