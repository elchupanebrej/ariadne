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
  | "MISSING_EVIDENCE_RESULT"
  | "INCOMPLETE_EVIDENCE_RESULT"
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

const invalidDependencyStatus = new Set([
  "FALSIFIED",
  "INVALIDATED",
  "NEEDS_REVIEW",
  "BLOCKED",
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

const transitionState = (node: Node): string | undefined =>
  text(node.lifecycle_state, node.transition_state, node.status);

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

    const linkedIds = linkedEvidenceIds(request, evidence, graph.edges);
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

      const verdict = typeof result.verdict === "string" ? result.verdict.toUpperCase() : undefined;
      const method = text(
        result.method,
        result.methodology,
      );
      const receipt =
        result.receipt ??
        result.stdout_digest ??
        result.telemetry_reference;
      const environment = text(
        result.environment,
        result.reproducible_environment,
        result.environment_ref,
      );
      const missing: string[] = [];
      if (!verdict || !["SUPPORTED", "FALSIFIED", "INCONCLUSIVE"].includes(verdict)) {
        missing.push("verdict (SUPPORTED, FALSIFIED, or INCONCLUSIVE)");
      }
      if (!method) missing.push("method");
      if (actual === undefined) missing.push("rung");
      if (!present(receipt)) missing.push("receipt");
      if (!environment) missing.push("environment");
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
    ["CLM", "CAN", "DEC", "TRANS"].includes(candidate.type),
  )) {
    for (const dependency of decisionDependencies(node, nodes, graph.edges)) {
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
    const dependencies = decisionDependencies(node, nodes, graph.edges);
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
        message: `${node.id} cannot be DERIVED from ${dependency.id} with ${dependency.provenance_type} provenance`,
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
    const missingContract = [
      ["target_mechanism_ref", targetId],
      ["retirement_predicate", transition.retirement_predicate],
      ["expiration_deadline", transition.expiration_deadline],
      ["cleanup_verification_test", transition.cleanup_verification_test],
      ["owner", transition.owner],
    ]
      .filter(([, value]) => !present(value))
      .map(([field]) => field);

    if (missingContract.length > 0 || !target || target.type !== "CAN" || lifecycleIndex < 0) {
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

    if (transition.status?.toUpperCase() === "BLOCKED") {
      diagnostics.push({
        code: "TRANSITION_BLOCKED",
        message: `${transition.id} is blocked and cannot pass the epistemic gate`,
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
