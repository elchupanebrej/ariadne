import type { Node } from "../core/schemas/nodes.js";
import { validateGraph } from "../graph/integrity.js";
import type { MaterializedGraph } from "../graph/domain.js";

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
  | "MISSING_EVIDENCE_RESULT"
  | "INCOMPLETE_EVIDENCE_RESULT"
  | "INCOMPATIBLE_EVIDENCE_METHOD"
  | "INVALID_DEPENDENCY_STATUS"
  | "INVALID_DERIVED_PROVENANCE"
  | "INVALID_TRANSITION"
  | "EXPIRED_TRANSITION"
  | "UNVERIFIED_TRANSITION"
  | "TRANSITION_BLOCKED"
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

const present = (value: unknown): boolean => {
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return isRecord(value) && Object.keys(value).length > 0;
};

const rung = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  const match = value.match(/\b(?:rung\s*)?(10|[1-9])\b/i);
  return match ? Number(match[1]) : undefined;
};

const actualEvidenceRung = (node: Node): number | undefined =>
  rung(node.rung ?? node.evidentiary_rung);

const requestedMinimumRung = (node: Node): number | undefined => {
  const requested = [rung(node.minimum_rung), rung(node.required_rung)].filter(
    (value): value is number => value !== undefined,
  );
  return requested.length > 0 ? Math.max(...requested) : undefined;
};

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

const claimClassOf = (node: Node, nodes: Map<string, Node>): string | undefined => {
  const direct = text(node.claim_class, node.claimClass, node.claim_type, node.claimType);
  if (direct) return direct;

  const claimReference = text(node.claim, node.claim_id, node.claimId);
  const claim = claimReference ? nodes.get(claimReference) : undefined;
  return claim?.type === "CLM"
    ? text(claim.claim_class, claim.claimClass, claim.claim_type, claim.claimType)
    : undefined;
};

const methodIncompatibleWithClaim = (claim: ClaimClass, method: string): boolean => {
  const normalized = method.toLowerCase();
  if (claim === "Throughput & Latency") {
    return /unit\s*test|example[- ]based|manual\s+check/u.test(normalized);
  }
  if (claim === "Distributed safety") {
    return /unit\s*test|local\s+sequential|single[- ]node|manual\s+check/u.test(normalized);
  }
  if (claim === "Migration safety") {
    return /unit\s*test|example[- ]based|staging\s+smoke|manual\s+check/u.test(normalized);
  }
  return false;
};

const evidenceResultIssues = (
  node: Node,
  options: { requireFalsified?: boolean } = {},
): string[] => {
  const issues: string[] = [];
  if (node.type !== "EVD") issues.push("EVD node");

  const verdict = typeof node.verdict === "string" ? node.verdict.toUpperCase() : undefined;
  if (!verdict || !["SUPPORTED", "FALSIFIED", "INCONCLUSIVE"].includes(verdict)) {
    issues.push("verdict (SUPPORTED, FALSIFIED, or INCONCLUSIVE)");
  } else if (options.requireFalsified && verdict !== "FALSIFIED") {
    issues.push("verdict FALSIFIED");
  }

  if (!text(node.method, node.methodology)) issues.push("method");
  if (actualEvidenceRung(node) === undefined) issues.push("rung");
  if (!present(node.receipt ?? node.stdout_digest ?? node.telemetry_reference)) {
    issues.push("receipt");
  }
  if (!text(node.environment, node.reproducible_environment, node.environment_ref)) {
    issues.push("environment");
  }
  return issues;
};

export const validateFalsifyingEvidence = (node: Node): string[] =>
  evidenceResultIssues(node, { requireFalsified: true });

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

const normalizedStatus = (value: unknown): string | undefined =>
  typeof value === "string" ? value.toUpperCase().replaceAll("-", "_") : undefined;

const locked = (node: Node): boolean => {
  const status = normalizedStatus(node.status);
  if (
    status === "SUPERSEDED" ||
    status === "RE_OPENED" ||
    status === "INVALIDATED" ||
    status === "REMOVED"
  ) {
    return false;
  }
  return node.provenance_type === "DECIDED" || status === "DECIDED";
};

type EvidenceIndex = {
  byId: Map<string, Node>;
  byRequestId: Map<string, Set<string>>;
};

const addEvidenceLink = (
  byRequestId: Map<string, Set<string>>,
  requestId: string,
  evidenceId: string,
): void => {
  const evidenceIds = byRequestId.get(requestId) ?? new Set<string>();
  evidenceIds.add(evidenceId);
  byRequestId.set(requestId, evidenceIds);
};

const buildEvidenceIndex = (
  evidence: Node[],
  edges: MaterializedGraph["edges"],
): EvidenceIndex => {
  const byId = new Map(evidence.map((candidate) => [candidate.id, candidate]));
  const byRequestId = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.type !== "answers") continue;
    if (byId.has(edge.source)) addEvidenceLink(byRequestId, edge.target, edge.source);
    if (byId.has(edge.target)) addEvidenceLink(byRequestId, edge.source, edge.target);
  }

  for (const candidate of evidence) {
    for (const requestId of [
      candidate.evidence_request_id,
      candidate.evidenceRequestId,
      candidate.request_id,
      candidate.requestId,
    ]) {
      if (typeof requestId === "string") addEvidenceLink(byRequestId, requestId, candidate.id);
    }
  }

  return { byId, byRequestId };
};

const linkedEvidenceIds = (request: Node, index: EvidenceIndex): string[] =>
  [...(index.byRequestId.get(request.id) ?? [])]
    .filter((id) => index.byId.has(id))
    .sort();

type DependencyAdjacency = Map<string, string[]>;

const buildDependencyAdjacency = (
  nodes: Map<string, Node>,
  edges: MaterializedGraph["edges"],
): DependencyAdjacency => {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (
      (edge.type !== "depends_on" && edge.type !== "derived_from") ||
      !nodes.has(edge.source) ||
      !nodes.has(edge.target)
    ) {
      continue;
    }
    const targets = adjacency.get(edge.source) ?? [];
    targets.push(edge.target);
    adjacency.set(edge.source, targets);
  }
  for (const targets of adjacency.values()) targets.sort((left, right) => left.localeCompare(right));
  return adjacency;
};

const decisionDependencies = (
  decision: Node,
  nodes: Map<string, Node>,
  adjacency: DependencyAdjacency,
): Node[] => {
  const directDependencies = [...(adjacency.get(decision.id) ?? [])];
  for (const dependency of Array.isArray(decision.dependencies) ? decision.dependencies : []) {
    if (typeof dependency === "string" && nodes.has(dependency)) directDependencies.push(dependency);
  }

  const queue = directDependencies.sort();
  const visited = new Set<string>();
  const result: Node[] = [];
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    const dependency = nodes.get(id);
    if (dependency) result.push(dependency);
    queue.push(...(adjacency.get(id) ?? []));
  }
  return result;
};

const invalidDependencyStatus = new Set([
  "FALSIFIED",
  "INVALIDATED",
  "NEEDS_REVIEW",
  "BLOCKED",
  "RE_OPENED",
  "STALE",
  "REQUIRES_REVALUATION",
  "SUPERSEDED",
]);

const isDerivedPremise = (provenance: unknown): boolean =>
  provenance === "FACT" || provenance === "MEASURED" || provenance === "DERIVED";

const TRANSITION_STATES = [
  "PROPOSED",
  "EXPANDED",
  "DUAL_RUNNING",
  "MIGRATING",
  "CONTRACTED",
  "RETIRED",
] as const;

const HARD_TRANSITION_STATUSES = new Set([
  "INVALIDATED",
  "FALSIFIED",
  "STALE",
  "RE_OPENED",
  "REQUIRES_REVALUATION",
  "BLOCKED",
  "NEEDS_REVIEW",
]);

const transitionState = (node: Node): string | undefined =>
  text(
    node.lifecycle_state,
    node.transition_lifecycle,
    node.lifecycle,
    node.transition_state,
    node.status,
  );

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
  const evidenceIndex = buildEvidenceIndex(evidence, graph.edges);
  const dependencyAdjacency = buildDependencyAdjacency(nodes, graph.edges);

  for (const request of graph.nodes.filter((node) => node.type === "EVDREQ")) {
    const rawClass = claimClassOf(request, nodes);
    const normalizedClass = claimClass(rawClass);
    const classMinimum = normalizedClass ? MINIMUM_EVIDENTIARY_RUNG[normalizedClass] : undefined;
    const requestedMinimum = requestedMinimumRung(request);
    const required = classMinimum === undefined
      ? requestedMinimum
      : Math.max(classMinimum, requestedMinimum ?? 0);
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

    const linkedIds = linkedEvidenceIds(request, evidenceIndex);
    if (linkedIds.length === 0) {
      diagnostics.push({
        code: "MISSING_EVIDENCE_RESULT",
        message: `Evidence request ${request.id} has no linked evidence result`,
        nodeId: request.id,
        requestId: request.id,
      });
    }

    for (const evidenceId of linkedIds) {
      const result = nodes.get(evidenceId);
      if (!result) continue;
      const actual = actualEvidenceRung(result);
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

      const missing = evidenceResultIssues(result);
      if (missing.length > 0) {
        diagnostics.push({
          code: "INCOMPLETE_EVIDENCE_RESULT",
          message: `Evidence ${result.id} is missing ${missing.join(", ")}`,
          nodeId: result.id,
          requestId: request.id,
          evidenceId: result.id,
          required,
        });
      }

      const method = text(result.method, result.methodology);
      if (normalizedClass && method && methodIncompatibleWithClaim(normalizedClass, method)) {
        diagnostics.push({
          code: "INCOMPATIBLE_EVIDENCE_METHOD",
          message: `Evidence ${result.id} uses method ${method}, which is incompatible with ${normalizedClass}`,
          nodeId: result.id,
          requestId: request.id,
          evidenceId: result.id,
          claimClass: rawClass,
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

  for (const node of graph.nodes.filter((candidate) =>
    ["CLM", "CAN", "DEC", "TRANS"].includes(candidate.type) &&
    normalizedStatus(candidate.status) !== "SUPERSEDED",
  )) {
    for (const dependency of decisionDependencies(node, nodes, dependencyAdjacency)) {
      if (typeof dependency.status !== "string") continue;
      const status = dependency.status.toUpperCase().replaceAll("-", "_");
      if (!invalidDependencyStatus.has(status)) continue;
      diagnostics.push({
        code: "INVALID_DEPENDENCY_STATUS",
        message: `${node.id} depends on ${dependency.id} with blocking ${status} status`,
        nodeId: node.id,
        dependencyId: dependency.id,
      });
    }
  }

  for (const node of graph.nodes.filter((candidate) => candidate.provenance_type === "DERIVED")) {
    const dependencies = decisionDependencies(node, nodes, dependencyAdjacency);
    if (dependencies.length === 0) {
      diagnostics.push({
        code: "INVALID_DERIVED_PROVENANCE",
        message: `${node.id} cannot claim DERIVED provenance without antecedent dependencies`,
        nodeId: node.id,
      });
      continue;
    }
    for (const dependency of dependencies) {
      if (isDerivedPremise(dependency.provenance_type)) continue;
      diagnostics.push({
        code: "INVALID_DERIVED_PROVENANCE",
        message: `${node.id} cannot be DERIVED from ${dependency.id} with ${dependency.provenance_type} provenance; downgrade ${node.id} provenance to ASSUMED/PROPOSED until ${dependency.id} resolves`,
        nodeId: node.id,
        dependencyId: dependency.id,
      });
    }
  }

  for (const transition of graph.nodes.filter((node) => node.type === "TRANS")) {
    const lifecycle = transitionState(transition);
    const lifecycleIndex = lifecycle
      ? TRANSITION_STATES.indexOf(lifecycle as (typeof TRANSITION_STATES)[number])
      : -1;
    const targetId = transition.target_mechanism_ref;
    const target = typeof targetId === "string" ? nodes.get(targetId) : undefined;
    const targetStatus = normalizedStatus(target?.status);
    const targetBlocked =
      target?.type === "CAN" &&
      targetStatus !== undefined &&
      HARD_TRANSITION_STATUSES.has(targetStatus);
    const missingContract = [
      ["target_mechanism_ref", targetId],
      ["retirement_predicate", transition.retirement_predicate],
      ["expiration_deadline", transition.expiration_deadline],
      ["cleanup_verification_test", transition.cleanup_verification_test],
      ["owner", transition.owner],
    ]
      .filter(([, value]) => !present(value))
      .map(([field]) => field);

    if (
      missingContract.length > 0 ||
      !target ||
      target.type !== "CAN" ||
      targetBlocked ||
      lifecycleIndex < 0
    ) {
      diagnostics.push({
        code: "INVALID_TRANSITION",
        message: `${transition.id} has an invalid contract, target candidate, or lifecycle state${missingContract.length > 0 ? ` (missing ${missingContract.join(", ")})` : ""}`,
        nodeId: transition.id,
      });
    }

    const deadline = typeof transition.expiration_deadline === "string"
      ? Date.parse(transition.expiration_deadline)
      : Number.NaN;
    if (Number.isNaN(deadline)) {
      diagnostics.push({
        code: "INVALID_TRANSITION",
        message: `${transition.id} must use a parseable expiration deadline`,
        nodeId: transition.id,
      });
    } else if (lifecycle !== "RETIRED" && deadline <= Date.now()) {
      diagnostics.push({
        code: "EXPIRED_TRANSITION",
        message: `${transition.id} expired at ${transition.expiration_deadline}`,
        nodeId: transition.id,
      });
    }

    const transitionStatus = normalizedStatus(transition.status);
    if (transitionStatus && HARD_TRANSITION_STATUSES.has(transitionStatus)) {
      diagnostics.push({
        code: "TRANSITION_BLOCKED",
        message: `${transition.id} has blocking ${transitionStatus} status and cannot pass the epistemic gate`,
        nodeId: transition.id,
      });
    }

    if (lifecycleIndex > 0) {
      const receipt =
        transition.transition_receipt ??
        transition.verification_receipt ??
        transition.receipt;
      if (transition.verified === false || !present(receipt)) {
        diagnostics.push({
          code: "UNVERIFIED_TRANSITION",
          message: `${transition.id} must provide a verification receipt before ${lifecycle}`,
          nodeId: transition.id,
        });
      }
    }

    if (lifecycle === "RETIRED" && transition.verified !== false) {
      const cleanupReceipt = transition.cleanup_verification_receipt;
      if (transition.cleanup_verified !== true && !present(cleanupReceipt)) {
        diagnostics.push({
          code: "UNVERIFIED_TRANSITION",
          message: `${transition.id} cannot be RETIRED without cleanup verification`,
          nodeId: transition.id,
        });
      }
    }
  }

  for (const decision of graph.nodes.filter((node) => node.type === "DEC" && locked(node))) {
    for (const dependency of decisionDependencies(decision, nodes, dependencyAdjacency)) {
      if (dependency.provenance_type === "ASSUMED" || dependency.provenance_type === "UNKNOWN") {
        const depStatus = normalizedStatus(dependency.status);
        const extra = dependency as unknown as { waived_by?: string; resolved_by?: string };
        if (
          dependency.type === "UNK" &&
          (depStatus === "WAIVED" ||
            depStatus === "RESOLVED" ||
            extra.waived_by !== undefined ||
            extra.resolved_by !== undefined)
        ) {
          continue;
        }
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
