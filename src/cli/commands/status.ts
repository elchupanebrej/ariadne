import type { EpistemicEdge } from "../../core/schemas/edges.js";
import type { Node } from "../../core/schemas/nodes.js";
import {
  isFrontierNode,
  type MaterializedGraph,
} from "../../graph/storage.js";
import {
  isUnresolvedMergeContradiction,
  mergeContradictionGuidance,
  mergeContradictionSubject,
} from "../../merge/three-way.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

export type { CliIO } from "../workspace.js";

type State = Record<string, unknown>;

export type StatusReport = {
  depth_mode: string;
  frontier: string[];
  open_unknowns: string[];
  graph_health: {
    healthy: boolean;
    nodes: number;
    edges: number;
    invalid_references: number;
  };
  merge_conflicts: Array<{
    id: string;
    subject: string;
    status: string;
    card: string;
    guidance: string;
    shadowed_node_id?: string;
  }>;
};

const asIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object" && "id" in item) {
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" ? [id] : [];
    }
    return [];
  });
};

const configuredIds = (state: State, keys: string[]): string[] => {
  for (const key of keys) {
    const ids = asIds(state[key]);
    if (ids.length > 0) return ids;
  }
  return [];
};

const configuredString = (state: State, keys: string[]): string | undefined => {
  for (const key of keys) {
    if (typeof state[key] === "string" && state[key]) return state[key] as string;
  }
  return undefined;
};

export function buildStatusReport(
  state: State | null,
  graph: MaterializedGraph,
): StatusReport {
  const frontierNodes = graph.nodes.filter(isFrontierNode);
  const frontierNodeIds = new Set(frontierNodes.map((node) => node.id));
  const configuredFrontier = configuredIds(state ?? {}, ["frontier", "active_frontier"]);
  const frontier =
    configuredFrontier.length > 0
      ? configuredFrontier.filter((id) => frontierNodeIds.has(id))
      : frontierNodes.map((node) => node.id);

  const openUnknownNodeIds = new Set(
    frontierNodes.filter((node) => node.type === "UNK").map((node) => node.id),
  );
  const configuredUnknowns = configuredIds(state ?? {}, [
    "open_unknowns",
    "openUnknowns",
    "unknowns",
  ]);
  const openUnknowns =
    configuredUnknowns.length > 0
      ? configuredUnknowns.filter((id) => openUnknownNodeIds.has(id))
      : [...openUnknownNodeIds];

  const ids = new Set(graph.nodes.map((node) => node.id));
  const invalidReferences = graph.edges.filter(
    (edge) => !ids.has(edge.source) || !ids.has(edge.target),
  ).length;
  const merge_conflicts = graph.nodes
    .filter(isUnresolvedMergeContradiction)
    .map((node) => {
      const subject = mergeContradictionSubject(node) ?? node.id;
      return {
        id: node.id,
        subject,
        status: node.status ?? "MERGE_CONFLICT",
        card: `.ariadne/cards/${node.id}.md`,
        guidance: mergeContradictionGuidance(node),
        ...(graph.nodes.some((candidate) => candidate.id === subject)
          ? { shadowed_node_id: subject }
          : {}),
      };
    });

  return {
    depth_mode:
      configuredString(state ?? {}, [
        "depth_mode",
        "active_depth_mode",
        "depthMode",
      ]) ?? "Standard",
    frontier,
    open_unknowns: openUnknowns,
    graph_health: {
      healthy: invalidReferences === 0,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      invalid_references: invalidReferences,
    },
    merge_conflicts,
  };
}

export type ContinuationDiagnostic = {
  severity: string;
  code: string;
  message: string;
  target: string;
  fix: string;
};

export type Continuation =
  | {
      readiness_class: "blocked";
      diagnostic: ContinuationDiagnostic;
    }
  | {
      readiness_class: string;
      next_action: string;
      operation: string;
      command_or_template: string;
      dependencies: string[];
      unlocks: string[];
      missingDeps?: string[];
    };

const CONTINUATION_EDGE_TYPES = new Set([
  "derived_from",
  "satisfies",
  "answers",
  "tests",
  "supports",
  "falsifies",
  "contradicts",
  "depends_on",
  "references",
]);

export type FrameSubgraph = {
  nodes: Node[];
  edges: EpistemicEdge[];
};

export type FrameComponent = {
  nodes: Node[];
  edges: EpistemicEdge[];
};

/**
 * All nodes connected to the frame through the existing edge types (direct plus
 * transitive), terminal nodes included. Pure projection: reads the materialized
 * graph, writes nothing.
 */
export function frameComponent(
  graph: MaterializedGraph,
  frameId: string,
): FrameComponent | null {
  if (!graph.nodes.some((node) => node.id === frameId)) return null;

  const neighbors = new Map<string, string[]>();
  const connect = (from: string, to: string): void => {
    const list = neighbors.get(from);
    if (list) list.push(to);
    else neighbors.set(from, [to]);
  };
  for (const edge of graph.edges) {
    if (!CONTINUATION_EDGE_TYPES.has(edge.type)) continue;
    connect(edge.source, edge.target);
    connect(edge.target, edge.source);
  }

  const connected = new Set<string>([frameId]);
  const queue = [frameId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of neighbors.get(current) ?? []) {
      if (connected.has(next)) continue;
      connected.add(next);
      queue.push(next);
    }
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const nodes = [...connected]
    .map((id) => nodeById.get(id)!)
    .sort((left, right) => left.id.localeCompare(right.id));
  const edges = graph.edges.filter(
    (edge) => connected.has(edge.source) && connected.has(edge.target),
  );
  return { nodes, edges };
}

/**
 * Subgraph connected to the frame, intersected with non-terminal nodes per the
 * frontier predicate.
 */
export function frameSubgraph(
  graph: MaterializedGraph,
  frameId: string,
): FrameSubgraph | null {
  const component = frameComponent(graph, frameId);
  if (!component) return null;

  const nodes = component.nodes.filter(isFrontierNode);
  const subgraphIds = new Set(nodes.map((node) => node.id));
  const edges = component.edges.filter(
    (edge) => subgraphIds.has(edge.source) && subgraphIds.has(edge.target),
  );
  return { nodes, edges };
}

const byId = (left: Node, right: Node): number => left.id.localeCompare(right.id);

const isDecisionId = (id: string): boolean => id.startsWith("DEC-");

const isValidatingSupport = (node: Node): boolean =>
  node.type === "EVD" ? node.verdict === "SUPPORTED" : true;

type ClassifyContext = FrameSubgraph & {
  component: FrameComponent;
  nodeById: Map<string, Node>;
};

type Classifier = {
  readiness_class: string;
  classify: (context: ClassifyContext) => Continuation | null;
};

const LIVE_PROPOSITION_TYPES = new Set(["CLM", "CAN", "ASM"]);

const isSuperseded = (node: Node): boolean =>
  String(node.status ?? "").toUpperCase() === "SUPERSEDED";

const classifyBlockedContradiction = ({
  nodes,
  edges,
}: ClassifyContext): Continuation | null => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const activeContradictors = new Set(
    edges
      .filter(
        (edge) =>
          edge.type === "contradicts" &&
          LIVE_PROPOSITION_TYPES.has(nodeById.get(edge.target)?.type ?? ""),
      )
      .map((edge) => edge.source),
  );
  const contradictions = nodes
    .filter(
      (node) =>
        node.type === "CTR" &&
        (activeContradictors.has(node.id) || isUnresolvedMergeContradiction(node)),
    )
    .sort(byId);
  const first = contradictions[0];
  if (!first) return null;

  return {
    readiness_class: "blocked-contradiction",
    next_action: `Resolve the contradiction ${first.id} before any other operation`,
    operation: "resolve_contradiction",
    command_or_template: isUnresolvedMergeContradiction(first)
      ? `ariadne merge-resolve ${first.id} --expected-digest <digest> --select-digest <digest>`
      : `Review .ariadne/cards/${first.id}.md, then ariadne invalidate ${first.id} --by <evidence-id>`,
    dependencies: [],
    unlocks: contradictions.slice(1).map((node) => node.id),
  };
};

const rungValue = (rung: unknown): number | null => {
  if (typeof rung === "number") return rung;
  if (typeof rung === "string") {
    const match = rung.match(/(\d+)\s*$/);
    return match ? Number(match[1]) : null;
  }
  return null;
};

const classifyBlockedEvidence = ({
  nodes,
  edges,
}: ClassifyContext): Continuation | null => {
  const verdictById = new Map(
    nodes
      .filter((node): node is Extract<Node, { type: "EVD" }> => node.type === "EVD")
      .map((node) => [node.id, node.verdict]),
  );
  const answerEdges = edges.filter((edge) => edge.type === "answers");
  const supportedAnswers = new Set(
    answerEdges
      .filter((edge) => verdictById.get(edge.source) === "SUPPORTED")
      .map((edge) => edge.target),
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const highestAnswerRung = (requestId: string): number | null => {
    let highest: number | null = null;
    for (const edge of answerEdges) {
      if (edge.target !== requestId) continue;
      const evidence = nodeById.get(edge.source);
      if (evidence?.type !== "EVD") continue;
      const rung = rungValue(evidence.rung ?? evidence.evidentiary_rung);
      if (rung !== null && (highest === null || rung > highest)) highest = rung;
    }
    return highest;
  };

  const outstanding = nodes
    .filter((node) => {
      if (node.type !== "EVDREQ") return false;
      if (!supportedAnswers.has(node.id)) return true;
      const required = rungValue(node.required_rung);
      if (required === null) return false;
      const highest = highestAnswerRung(node.id);
      return highest === null || required > highest;
    })
    .sort(byId);
  const first = outstanding[0];
  if (!first) return null;

  return {
    readiness_class: "blocked-evidence",
    next_action: `Execute the pinned method for ${first.id} and record the evidence result`,
    operation: "execute_pinned_method_and_record_evidence",
    command_or_template:
      `ariadne node add EVD <EVD-id> --title <evidence> --payload '{"verdict":"SUPPORTED"}'` +
      ` && ariadne edge add <EVD-id> answers ${first.id}`,
    dependencies: [],
    unlocks: outstanding.slice(1).map((node) => node.id),
  };
};

const classifyBlockedDependency = ({
  nodes,
  edges,
  nodeById,
}: ClassifyContext): Continuation | null => {
  const unmetDeps = (candidate: Node): string[] => {
    const depIds = new Set([
      ...(candidate.dependencies ?? []),
      ...edges
        .filter((edge) => edge.type === "depends_on" && edge.source === candidate.id)
        .map((edge) => edge.target),
    ]);
    return [...depIds]
      .filter((id) => {
        const dep = nodeById.get(id);
        return dep !== undefined && isFrontierNode(dep) && !isSuperseded(dep);
      })
      .sort();
  };

  const blocked = nodes
    .filter((node) => node.type === "CAN" && unmetDeps(node).length > 0)
    .sort(byId);
  const first = blocked[0];
  if (!first) return null;
  const missingDeps = unmetDeps(first);

  return {
    readiness_class: "blocked-dependency",
    next_action: `Advance or satisfy ${missingDeps[0]}, the unmet dependency of ${first.id}`,
    operation: "resolve_dependency",
    command_or_template: `ariadne node update ${missingDeps[0]} --payload '{"status":"RESOLVED"}'`,
    dependencies: missingDeps,
    unlocks: blocked.slice(1).map((node) => node.id),
    missingDeps,
  };
};

const classifyReady = ({ nodes, edges }: ClassifyContext): Continuation | null => {
  const candidates = nodes.filter((node) => node.type === "CAN").sort(byId);
  const ready = candidates.find((candidate) => {
    const supporting = edges.filter(
      (edge) => edge.type === "supports" && edge.target === candidate.id,
    );
    if (supporting.length === 0) return false;
    const sourceById = new Map(nodes.map((node) => [node.id, node]));
    if (!supporting.every((edge) => {
      const source = sourceById.get(edge.source);
      return source !== undefined && isValidatingSupport(source);
    })) {
      return false;
    }
    const attacked = edges.some(
      (edge) =>
        (edge.type === "contradicts" ||
          edge.type === "invalidates" ||
          edge.type === "falsifies") &&
        edge.target === candidate.id,
    );
    if (attacked) return false;
    const decidedAlready = edges.some(
      (edge) =>
        (edge.type === "satisfies" || edge.type === "answers") &&
        (isDecisionId(edge.source) || isDecisionId(edge.target)),
    );
    return !decidedAlready;
  });
  if (!ready) return null;

  return {
    readiness_class: "ready",
    next_action: `Record the decision for ${ready.id}`,
    operation: "record_decision",
    command_or_template:
      `ariadne node add DEC <DEC-id> --title <decision> --payload '{"provenance_type":"DECIDED"}'` +
      ` && ariadne edge add <DEC-id> satisfies ${ready.id}`,
    dependencies: [],
    unlocks: candidates
      .filter((candidate) => candidate.id !== ready.id)
      .map((candidate) => candidate.id),
  };
};

const classifyInsufficientInformation = ({
  nodes,
  edges,
}: ClassifyContext): Continuation | null => {
  const evidenceResults = new Set(
    nodes.filter((node) => node.type === "EVD").map((node) => node.id),
  );
  const evidenceRequests = new Set(
    nodes.filter((node) => node.type === "EVDREQ").map((node) => node.id),
  );
  const testedOrFalsified = new Set(
    edges
      .filter(
        (edge) =>
          (edge.type === "tests" || edge.type === "falsifies") &&
          evidenceResults.has(edge.source),
      )
      .map((edge) => edge.target),
  );
  const requested = new Set(
    edges
      .filter(
        (edge) =>
          evidenceRequests.has(edge.source) &&
          (edge.type === "tests" || edge.type === "depends_on"),
      )
      .map((edge) => edge.target),
  );
  const insufficient = nodes
    .filter(
      (node) =>
        (node.provenance_type === "UNKNOWN" || node.provenance_type === "ASSUMED") &&
        !testedOrFalsified.has(node.id) &&
        !requested.has(node.id),
    )
    .sort(byId);
  const first = insufficient[0];
  if (!first) return null;

  return {
    readiness_class: "insufficient-information",
    next_action: `Raise an explicit ${first.type} for ${first.id} plus one evidence request`,
    operation: "raise_unknown_and_evidence_request",
    command_or_template:
      `ariadne node add ${first.type} <new-id> --title <statement> --payload '{"provenance_type":"${first.provenance_type}"}'` +
      ` && ariadne node add EVDREQ <EVDREQ-id> --title <question> --payload '{"claim":"${first.id}"}'` +
      ` && ariadne edge add <EVDREQ-id> tests ${first.id}`,
    dependencies: [],
    unlocks: insufficient.slice(1).map((node) => node.id),
  };
};

const classifyBlocked = ({ component }: ClassifyContext): Continuation | null => {
  const blockers: Array<{
    id: string;
    code: string;
    message: string;
    fix: string;
  }> = [];
  for (const node of component.nodes) {
    const status = String(node.status ?? "").toUpperCase();
    if (node.type === "CTR" && isFrontierNode(node)) {
      blockers.push({
        id: node.id,
        code: "unresolved-contradiction",
        message: `Contradiction ${node.id} is unresolved; every candidate path through this frame crosses it.`,
        fix: `Resolve the contradiction recorded in .ariadne/cards/${node.id}.md before continuing.`,
      });
    } else if (status === "INVALIDATED" || status === "SUPERSEDED") {
      blockers.push({
        id: node.id,
        code: "invalidated-path",
        message: `Node ${node.id} is ${status.toLowerCase()}; every candidate path through this frame crosses it.`,
        fix: `Raise a fresh candidate that does not depend on ${node.id}.`,
      });
    } else if (
      node.type === "TRANS" &&
      isFrontierNode(node) &&
      typeof node.owner === "string" &&
      node.transition_receipt === undefined
    ) {
      blockers.push({
        id: node.id,
        code: "missing-owner-receipt",
        message: `Transition ${node.id} has no owner receipt; every candidate path through this frame crosses it.`,
        fix: `Record the owner receipt: ariadne node update ${node.id} --payload '{"transition_receipt":"<receipt>"}'`,
      });
    }
  }
  blockers.sort((left, right) => left.id.localeCompare(right.id));
  const first = blockers[0];
  if (!first) return null;

  return {
    readiness_class: "blocked",
    diagnostic: {
      severity: "error",
      code: first.code,
      message: first.message,
      target: first.id,
      fix: first.fix,
    },
  };
};

// Fail-closed priority order (ticket 16): blocked-* classes first, then ready,
// then insufficient-information; the fully blocked diagnostic is the fall-through.
const CLASSIFIERS: readonly Classifier[] = [
  { readiness_class: "blocked-contradiction", classify: classifyBlockedContradiction },
  { readiness_class: "blocked-evidence", classify: classifyBlockedEvidence },
  { readiness_class: "blocked-dependency", classify: classifyBlockedDependency },
  { readiness_class: "ready", classify: classifyReady },
  {
    readiness_class: "insufficient-information",
    classify: classifyInsufficientInformation,
  },
  { readiness_class: "blocked", classify: classifyBlocked },
];

export function buildContinuation(
  graph: MaterializedGraph,
  frameId: string,
): Continuation | null {
  const component = frameComponent(graph, frameId);
  if (!component) return null;
  const nodes = component.nodes.filter(isFrontierNode);
  const subgraphIds = new Set(nodes.map((node) => node.id));
  const edges = component.edges.filter(
    (edge) => subgraphIds.has(edge.source) && subgraphIds.has(edge.target),
  );
  const context: ClassifyContext = {
    nodes,
    edges,
    component,
    nodeById: new Map(graph.nodes.map((node) => [node.id, node])),
  };
  for (const { classify } of CLASSIFIERS) {
    const continuation = classify(context);
    if (continuation) return continuation;
  }
  return null;
}

const STATUS_USAGE = "Usage: ariadne status [FRAME-id] [--json]\n";

export async function runStatus(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(STATUS_USAGE);
    return 0;
  }
  const json = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  if (positional.length > 1 || positional.some((arg) => arg.startsWith("--"))) {
    throw new Error(STATUS_USAGE.trim());
  }
  const [frameId] = positional;

  const { storage } = await resolveCliWorkspace(io);
  const graph = await storage.materialize();
  const report = buildStatusReport(await storage.readState<State>(), graph);

  let continuation: Continuation | null = null;
  if (frameId !== undefined) {
    if (!graph.nodes.some((node) => node.id === frameId)) {
      throw new Error(`Unknown FRAME: ${frameId}`);
    }
    continuation = buildContinuation(graph, frameId);
  }

  if (json) {
    io.stdout.write(
      `${JSON.stringify(continuation ? { ...report, continuation } : report)}\n`,
    );
    return 0;
  }

  io.stdout.write(
    [
      "Ariadne status",
      `Depth mode: ${report.depth_mode}`,
      `Frontier: ${report.frontier.length > 0 ? report.frontier.join(", ") : "none"}`,
      `Open unknowns: ${
        report.open_unknowns.length > 0 ? report.open_unknowns.join(", ") : "none"
      }`,
      `Graph health: ${report.graph_health.healthy ? "healthy" : "unhealthy"} ` +
        `(${report.graph_health.nodes} nodes, ${report.graph_health.edges} edges)`,
      `Merge conflicts: ${
        report.merge_conflicts.length > 0
          ? report.merge_conflicts.map(({ id, subject }) => `${id} (${subject})`).join(", ")
          : "none"
      }`,
      ...(continuation
        ? "diagnostic" in continuation
          ? [
              `Blocked (${continuation.diagnostic.severity}) [${continuation.diagnostic.code}]: ${continuation.diagnostic.message}`,
              `Target: ${continuation.diagnostic.target}`,
              `Fix: ${continuation.diagnostic.fix}`,
            ]
          : [
              `Next action (${continuation.readiness_class}): ${continuation.next_action}`,
              `Operation: ${continuation.operation}`,
              `Command: ${continuation.command_or_template}`,
            ]
        : []),
      "",
    ].join("\n"),
  );
  return 0;
}
