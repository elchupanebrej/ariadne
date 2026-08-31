import { createHash } from "node:crypto";
import {
  GraphEventSchema,
  type GraphEvent,
  type MaterializedGraph,
} from "../graph/storage.js";
import { validateGraph, type GraphDiagnostic } from "../graph/integrity.js";
import { buildInfluenceAdjacency } from "../graph/invalidation.js";
import type { EpistemicEdge } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";

export const MERGE_PROTOCOL_VERSION = 1 as const;

export const MERGE_LIMITS = {
  maxInputBytes: 16 * 1024 * 1024,
  maxNodes: 100_000,
  maxEdges: 250_000,
  maxQuarantinedSubjects: 50_000,
} as const;

export type MergeOutcome = "CLEAN" | "DIVERGED" | "FAILED";
export type MergeSource = "base" | "current" | "incoming";

export type MergeDiagnostic = {
  code: string;
  message: string;
  source?: MergeSource;
  subject?: string;
};

export type MergeReceipt = {
  outcome: MergeOutcome;
  merge_protocol_version: number;
  source_labels: Record<MergeSource, string>;
  input_digests: Record<MergeSource, string>;
  output_digest: string;
  applied_subjects: string[];
  deduplicated_subjects: string[];
  created_conflict_ids: string[];
  quarantined_subjects: string[];
  diagnostics: MergeDiagnostic[];
  deterministic_detection_coverage: {
    canonical_json: boolean;
    materialized_models: boolean;
    ancestor_three_way: boolean;
    node_id_identity: boolean;
    edge_identity: boolean;
    referential_integrity: boolean;
    deductive_dag: boolean;
    natural_language_equivalence: boolean;
  };
  post_merge_verification_requirement: string | null;
};

export type MergeResult = {
  output: string | null;
  receipt: MergeReceipt;
};

export type MergeOptions = {
  protocolVersion?: number;
  operation?: string;
  limits?: Partial<Record<keyof typeof MERGE_LIMITS, number>>;
};

type ParsedInput = {
  events: GraphEvent[];
  graph: MaterializedGraph;
  edgeStates: Map<string, EdgeState>;
  digest: string;
  diagnostics: MergeDiagnostic[];
};

const sourceLabels: Record<MergeSource, string> = {
  base: "common ancestor",
  current: "current branch",
  incoming: "incoming branch",
};

const coverage: MergeReceipt["deterministic_detection_coverage"] = {
  canonical_json: true,
  materialized_models: true,
  ancestor_three_way: true,
  node_id_identity: true,
  edge_identity: true,
  referential_integrity: true,
  deductive_dag: true,
  natural_language_equivalence: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Canonical JSON is used for semantic equality and stable output ordering. */
export const canonicalJson = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const nodeFields = (node: Node): Record<string, unknown> =>
  node as unknown as Record<string, unknown>;

const edgeSubject = (edge: EpistemicEdge): string =>
  `${edge.source}:${edge.type}:${edge.target}`;

type EdgeState =
  | { operation: "present"; value: EpistemicEdge }
  | { operation: "delete"; value: EpistemicEdge }
  | { operation: "absent"; value: null };

type MergeBranch = Exclude<MergeSource, "base">;

type QuarantinedNode = {
  source: MergeBranch;
  source_label: string;
  source_digest: string;
  operation: "present" | "delete";
  value: Node;
};

type QuarantinedEdge = {
  source: MergeBranch;
  source_label: string;
  source_digest: string;
  operation: "present" | "delete";
  value: EpistemicEdge;
};

type Quarantine = {
  nodes: QuarantinedNode[];
  edges: QuarantinedEdge[];
};

const isDeletedNode = (node: Node | undefined): boolean =>
  node !== undefined &&
  (nodeFields(node).tombstone === true ||
    (typeof nodeFields(node).status === "string" &&
      (nodeFields(node).status as string).toUpperCase() === "REMOVED"));

const semanticNode = (node: Node | undefined): Node | undefined =>
  isDeletedNode(node) ? undefined : node;

const activeGraph = (graph: MaterializedGraph): MaterializedGraph => ({
  nodes: graph.nodes.filter((node) => !isDeletedNode(node)),
  edges: graph.edges,
});

export const isUnresolvedMergeContradiction = (node: Node): boolean =>
  node.type === "CTR" &&
  nodeFields(node).conflict_kind === "branch_merge" &&
  nodeFields(node).status === "MERGE_CONFLICT";

export const mergeContradictionSubject = (node: Node): string | undefined => {
  const subject = nodeFields(node).subject_key;
  return typeof subject === "string" ? subject : undefined;
};

export const mergeContradictionGuidance = (node: Node): string => {
  const guidance = nodeFields(node).reconciliation_guidance;
  return typeof guidance === "string"
    ? guidance
    : "Reconcile this merge contradiction before selecting a canonical revision.";
};

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const materialize = (events: readonly GraphEvent[]): MaterializedGraph => {
  const nodes = new Map<string, Node>();
  const edges = new Map<string, EpistemicEdge>();
  const edgeKey = (edge: EpistemicEdge): string =>
    `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

  for (const event of events) {
    if (event.kind === "node") nodes.set(event.node.id, event.node);
    else if (event.tombstone) edges.delete(edgeKey(event.edge));
    else edges.set(edgeKey(event.edge), event.edge);
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) => edgeKey(left).localeCompare(edgeKey(right))),
  };
};

const edgeStatesFor = (events: readonly GraphEvent[]): Map<string, EdgeState> => {
  const states = new Map<string, EdgeState>();
  for (const event of events) {
    if (event.kind !== "edge") continue;
    states.set(edgeSubject(event.edge), {
      operation: event.tombstone ? "delete" : "present",
      value: event.edge,
    });
  }
  return states;
};

const diagnosticFromGraph = (
  source: MergeSource,
  diagnostic: GraphDiagnostic,
): MergeDiagnostic => ({
  code: diagnostic.code,
  message: diagnostic.message,
  source,
  ...(diagnostic.nodeId ? { subject: diagnostic.nodeId } : {}),
});

const effectiveLimits = (options: MergeOptions): typeof MERGE_LIMITS =>
  Object.fromEntries(
    Object.entries(MERGE_LIMITS).map(([key, hardLimit]) => [
      key,
      Math.min(
        hardLimit,
        Math.max(0, Math.floor(options.limits?.[key as keyof typeof MERGE_LIMITS] ?? hardLimit)),
      ),
    ]),
  ) as typeof MERGE_LIMITS;

const parseInput = (
  raw: string,
  source: MergeSource,
  limits: typeof MERGE_LIMITS,
): ParsedInput => {
  const fallbackDigest = digest(raw);
  const diagnostics: MergeDiagnostic[] = [];
  if (Buffer.byteLength(raw, "utf8") > limits.maxInputBytes) {
    diagnostics.push({
      code: "INPUT_BYTES_CEILING_EXCEEDED",
      message: `${source} input exceeds the ${limits.maxInputBytes}-byte merge ceiling`,
      source,
    });
    return {
      events: [],
      graph: { nodes: [], edges: [] },
      edgeStates: new Map(),
      digest: fallbackDigest,
      diagnostics,
    };
  }

  const events: GraphEvent[] = [];
  for (const [index, line] of raw.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      diagnostics.push({
        code: "MALFORMED_JSONL",
        message: `${source} line ${index + 1} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        source,
      });
      break;
    }
    const parsed = GraphEventSchema.safeParse(value);
    if (!parsed.success) {
      diagnostics.push({
        code: "INVALID_GRAPH_EVENT",
        message: `${source} line ${index + 1} does not satisfy the graph event schema`,
        source,
      });
      break;
    }
    events.push(parsed.data);
  }

  if (diagnostics.length > 0) {
    return {
      events,
      graph: materialize(events),
      edgeStates: edgeStatesFor(events),
      digest: fallbackDigest,
      diagnostics,
    };
  }

  const graph = materialize(events);
  const validation = validateGraph(graph);
  diagnostics.push(...validation.diagnostics.map((item) => diagnosticFromGraph(source, item)));
  if (validation.valid) {
    diagnostics.push(
      ...validateGraph(activeGraph(graph)).diagnostics.map((item) =>
        diagnosticFromGraph(source, item),
      ),
    );
  }

  const nodeEventCount = events.filter((event) => event.kind === "node").length;
  const edgeEventCount = events.filter((event) => event.kind === "edge").length;
  if (graph.nodes.length > limits.maxNodes || nodeEventCount > limits.maxNodes) {
    diagnostics.push({
      code: "NODE_COUNT_CEILING_EXCEEDED",
      message: `${source} input exceeds the ${limits.maxNodes}-node merge ceiling`,
      source,
    });
  }
  if (graph.edges.length > limits.maxEdges || edgeEventCount > limits.maxEdges) {
    diagnostics.push({
      code: "EDGE_COUNT_CEILING_EXCEEDED",
      message: `${source} input exceeds the ${limits.maxEdges}-edge merge ceiling`,
      source,
    });
  }

  return {
    events,
    graph,
    edgeStates: edgeStatesFor(events),
    digest: digest(events.map(canonicalJson).join("\n")),
    diagnostics,
  };
};

const equal = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);

const nodeRemoval = (node: Node): Node => ({
  ...node,
  status: "REMOVED",
  tombstone: true,
});

type ConflictVariant = {
  source: MergeBranch;
  source_label: string;
  source_digest: string;
  variant_digest: string;
  operation: "present" | "delete" | "absent";
  value: Node | EpistemicEdge | null;
};

const variantFor = (
  source: MergeBranch,
  node: Node | undefined,
  sourceDigest: string,
): ConflictVariant => ({
  source,
  source_label: sourceLabels[source],
  source_digest: sourceDigest,
  variant_digest: digest(canonicalJson(node ?? null)),
  operation: node === undefined ? "absent" : isDeletedNode(node) ? "delete" : "present",
  value: node ?? null,
});

const conflictNode = ({
  subject,
  base,
  current,
  incoming,
  inputDigests,
  diagnosticCode,
}: {
  subject: string;
  base: Node | undefined;
  current: Node | undefined;
  incoming: Node | undefined;
  inputDigests: Record<MergeSource, string>;
  diagnosticCode: string;
}): Node => {
  const variants = [
    variantFor("current", current, inputDigests.current),
    variantFor("incoming", incoming, inputDigests.incoming),
  ].sort((left, right) =>
    `${left.variant_digest}:${left.source}`.localeCompare(`${right.variant_digest}:${right.source}`),
  );
  const baseValue = base ?? null;
  const baseDigest = digest(canonicalJson(baseValue));
  const variantDigests = variants.map(({ variant_digest }) => variant_digest).sort();
  const identity = {
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    conflict_kind: "branch_merge",
    subject_key: subject,
    base_digest: baseDigest,
    variant_digests: variantDigests,
  };
  const incidentDigest = digest(canonicalJson(identity));
  const payloadDigest = digest(
    canonicalJson({
      ...identity,
      base_value: baseValue,
      variants: variants.map(({ variant_digest, value }) => ({ variant_digest, value })),
    }),
  );
  const id = `CTR-merge-${incidentDigest.slice(0, 16)}`;
  const nodePayload: Record<string, unknown> = {
    id,
    type: "CTR",
    provenance_type: "FACT",
    title: `Merge contradiction: ${subject}`,
    statement: `Current and incoming branches diverge for ${subject}; reconcile a canonical revision.`,
    status: "MERGE_CONFLICT",
    conflict_kind: "branch_merge",
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    subject_key: subject,
    base_value: baseValue,
    base_digest: baseDigest,
    variants,
    variant_digests: variantDigests,
    source_digests: inputDigests,
    source_labels: sourceLabels,
    diagnostic_codes: [diagnosticCode],
    conflict_digest: payloadDigest,
    reconciliation_guidance:
      "Select the base or a stored variant by digest, or submit a validated ariadne-delta with the expected conflict digest.",
    quarantined: { nodes: [], edges: [] },
    ...(base && !isDeletedNode(base) ? { shadowed_subject: subject, shadowed_by: id } : {}),
  };
  return nodePayload as Node;
};

const edgeVariantFor = (
  source: MergeBranch,
  state: EdgeState | undefined,
  sourceDigest: string,
): ConflictVariant => ({
  source,
  source_label: sourceLabels[source],
  source_digest: sourceDigest,
  variant_digest: digest(canonicalJson(state?.value ?? null)),
  operation: state?.operation ?? "absent",
  value: state?.value ?? null,
});

const edgeConflictNode = ({
  subject,
  base,
  current,
  incoming,
  inputDigests,
}: {
  subject: string;
  base: EdgeState | undefined;
  current: EdgeState | undefined;
  incoming: EdgeState | undefined;
  inputDigests: Record<MergeSource, string>;
}): Node => {
  const variants = [
    edgeVariantFor("current", current, inputDigests.current),
    edgeVariantFor("incoming", incoming, inputDigests.incoming),
  ].sort((left, right) =>
    `${left.variant_digest}:${left.source}`.localeCompare(`${right.variant_digest}:${right.source}`),
  );
  const baseValue = base?.operation === "present" ? base.value : null;
  const baseDigest = digest(canonicalJson(baseValue));
  const variantDigests = variants.map(({ variant_digest }) => variant_digest).sort();
  const identity = {
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    conflict_kind: "branch_merge",
    subject_key: subject,
    base_digest: baseDigest,
    variant_digests: variantDigests,
  };
  const payloadDigest = digest(
    canonicalJson({
      ...identity,
      base_value: baseValue,
      variants: variants.map(({ variant_digest, value, operation }) => ({
        variant_digest,
        operation,
        value,
      })),
    }),
  );
  const nodePayload: Record<string, unknown> = {
    id: `CTR-merge-${digest(canonicalJson(identity)).slice(0, 16)}`,
    type: "CTR",
    provenance_type: "FACT",
    title: `Merge contradiction: ${subject}`,
    statement: `Current and incoming branches diverge for ${subject}; reconcile a canonical edge state.`,
    status: "MERGE_CONFLICT",
    conflict_kind: "branch_merge",
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    subject_key: subject,
    base_value: baseValue,
    base_digest: baseDigest,
    variants,
    variant_digests: variantDigests,
    source_digests: inputDigests,
    source_labels: sourceLabels,
    diagnostic_codes: ["EDGE_STATE_CONFLICT"],
    conflict_digest: payloadDigest,
    reconciliation_guidance:
      "Select the base or a stored variant by digest, or submit a validated ariadne-delta with the expected conflict digest.",
    quarantined: {
      nodes: [],
      edges: variants
        .filter((variant): variant is ConflictVariant & { value: EpistemicEdge } =>
          variant.value !== null,
        )
        .map(({ source, source_label, source_digest, operation, value }) => ({
          source,
          source_label,
          source_digest,
          operation: operation === "delete" ? "delete" : "present",
          value,
        })),
    },
  };
  return nodePayload as Node;
};

const topologyConflictNode = ({
  subject,
  diagnosticCodes,
  quarantined,
  inputDigests,
}: {
  subject: string;
  diagnosticCodes: string[];
  quarantined: Quarantine;
  inputDigests: Record<MergeSource, string>;
}): Node => {
  const sortedCodes = [...new Set(diagnosticCodes)].sort((left, right) => left.localeCompare(right));
  const sortedQuarantine = {
    nodes: [...quarantined.nodes].sort((left, right) =>
      `${left.value.id}:${left.operation}:${left.source}`.localeCompare(
        `${right.value.id}:${right.operation}:${right.source}`,
      ),
    ),
    edges: [...quarantined.edges].sort((left, right) =>
      `${edgeSubject(left.value)}:${left.operation}:${left.source}`.localeCompare(
        `${edgeSubject(right.value)}:${right.operation}:${right.source}`,
      ),
    ),
  };
  const identity = {
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    conflict_kind: "branch_merge",
    subject_key: subject,
    diagnostic_codes: sortedCodes,
    quarantined: {
      nodes: sortedQuarantine.nodes.map(({ operation, value }) => ({ operation, value })),
      edges: sortedQuarantine.edges.map(({ operation, value }) => ({ operation, value })),
    },
  };
  const baseDigest = digest(canonicalJson(null));
  const payloadDigest = digest(canonicalJson({ ...identity, source_digests: inputDigests }));
  const nodePayload: Record<string, unknown> = {
    id: `CTR-merge-${digest(canonicalJson(identity)).slice(0, 16)}`,
    type: "CTR",
    provenance_type: "FACT",
    title: `Merge contradiction: ${subject}`,
    statement: `Current and incoming branches create an incompatible graph topology for ${subject}; reconcile the quarantined states.`,
    status: "MERGE_CONFLICT",
    conflict_kind: "branch_merge",
    merge_protocol_version: MERGE_PROTOCOL_VERSION,
    subject_key: subject,
    base_value: null,
    base_digest: baseDigest,
    variants: [],
    variant_digests: [],
    source_digests: inputDigests,
    source_labels: sourceLabels,
    diagnostic_codes: sortedCodes,
    conflict_digest: payloadDigest,
    reconciliation_guidance:
      "Select or synthesize validated graph changes that release the quarantined topology.",
    quarantined: sortedQuarantine,
  };
  return nodePayload as Node;
};

const absentEdgeState = (): EdgeState => ({ operation: "absent", value: null });

const edgeStateFor = (
  states: Map<string, EdgeState>,
  subject: string,
): EdgeState => states.get(subject) ?? absentEdgeState();

const edgeEventFor = (
  state: EdgeState,
  base: EdgeState,
): GraphEvent | undefined => {
  if (state.operation === "present") return { kind: "edge", edge: state.value };
  if (state.operation === "delete") {
    return { kind: "edge", edge: state.value, tombstone: true };
  }
  return base.operation === "present"
    ? { kind: "edge", edge: base.value, tombstone: true }
    : undefined;
};

const failure = (
  inputDigests: Record<MergeSource, string>,
  currentBytes: string,
  diagnostics: MergeDiagnostic[],
  protocolVersion: number = MERGE_PROTOCOL_VERSION,
): MergeResult => ({
  output: null,
  receipt: {
    outcome: "FAILED",
    merge_protocol_version: protocolVersion,
    source_labels: sourceLabels,
    input_digests: inputDigests,
    output_digest: digest(currentBytes),
    applied_subjects: [],
    deduplicated_subjects: [],
    created_conflict_ids: [],
    quarantined_subjects: [],
    diagnostics,
    deterministic_detection_coverage: coverage,
    post_merge_verification_requirement: null,
  },
});

export function mergeBranchModels(
  inputs: { base: string; current: string; incoming: string },
  options: MergeOptions = {},
): MergeResult {
  const protocolVersion = options.protocolVersion ?? MERGE_PROTOCOL_VERSION;
  const inputDigests = {
    base: digest(inputs.base),
    current: digest(inputs.current),
    incoming: digest(inputs.incoming),
  } satisfies Record<MergeSource, string>;

  if (protocolVersion !== MERGE_PROTOCOL_VERSION) {
    return failure(
      inputDigests,
      inputs.current,
      [{
        code: "UNSUPPORTED_MERGE_PROTOCOL",
        message: `Merge protocol ${String(protocolVersion)} is not supported; expected ${MERGE_PROTOCOL_VERSION}`,
      }],
      protocolVersion,
    );
  }
  if (options.operation && options.operation !== "merge") {
    return failure(
      inputDigests,
      inputs.current,
      [{
        code: "UNSUPPORTED_GIT_OPERATION",
        message: `Only ordinary git merge is supported; detected ${options.operation}`,
      }],
    );
  }

  const limits = effectiveLimits(options);
  const parsed = {
    base: parseInput(inputs.base, "base", limits),
    current: parseInput(inputs.current, "current", limits),
    incoming: parseInput(inputs.incoming, "incoming", limits),
  } satisfies Record<MergeSource, ParsedInput>;
  const inputDiagnostics = Object.values(parsed).flatMap(({ diagnostics }) => diagnostics);
  if (inputDiagnostics.length > 0) return failure(inputDigests, inputs.current, inputDiagnostics);
  const normalizedInputDigests = {
    base: parsed.base.digest,
    current: parsed.current.digest,
    incoming: parsed.incoming.digest,
  } satisfies Record<MergeSource, string>;

  const baseNodes = new Map(parsed.base.graph.nodes.map((node) => [node.id, node]));
  const currentNodes = new Map(parsed.current.graph.nodes.map((node) => [node.id, node]));
  const incomingNodes = new Map(parsed.incoming.graph.nodes.map((node) => [node.id, node]));
  const nodeIds = [...new Set([...baseNodes, ...currentNodes, ...incomingNodes].map(([id]) => id))]
    .sort((left, right) => left.localeCompare(right));

  const baseEdges = new Map(parsed.base.graph.edges.map((edge) => [edgeSubject(edge), edge]));
  const baseEdgeStates = parsed.base.edgeStates;
  const currentEdgeStates = parsed.current.edgeStates;
  const incomingEdgeStates = parsed.incoming.edgeStates;
  const edgeKeys = [
    ...new Set([
      ...baseEdgeStates,
      ...currentEdgeStates,
      ...incomingEdgeStates,
    ].map(([key]) => key)),
  ]
    .sort((left, right) => left.localeCompare(right));

  const events: GraphEvent[] = [];
  const appliedSubjects: string[] = [];
  const deduplicatedSubjects: string[] = [];
  const createdConflictIds: string[] = [];
  const quarantinedSubjects = new Set<string>();
  const quarantineCeilingSubjects = new Set<string>();
  const diagnostics: MergeDiagnostic[] = [];
  const conflicts = new Map<string, Node>();
  const nodeConflictSubjects = new Set<string>();
  const supersededBy = new Map<string, Node>();
  const quarantinedEventSubjects = new Set<string>();
  const quarantineNode = (id: string): void => {
    quarantinedSubjects.add(id);
    quarantineCeilingSubjects.add(id);
  };
  const quarantineEdge = (key: string): void => {
    quarantinedSubjects.add(key.replaceAll("\u0000", ":"));
    const [source, , target] = key.split("\u0000");
    if (source) quarantineCeilingSubjects.add(source);
    if (target) quarantineCeilingSubjects.add(target);
  };

  const choose = <T>(
    subject: string,
    base: T | undefined,
    current: T | undefined,
    incoming: T | undefined,
    event: (value: T | undefined, baseValue: T | undefined) => GraphEvent | undefined,
  ): void => {
    const currentChanged = !equal(current, base);
    const incomingChanged = !equal(incoming, base);
    if (currentChanged && incomingChanged && !equal(current, incoming)) {
      diagnostics.push({
        code: "INCOMPATIBLE_BRANCH_CHANGE",
        message: `Current and incoming branches changed ${subject} differently`,
        subject,
      });
      return;
    }
    if (!currentChanged && !incomingChanged) return;
    const value = currentChanged ? current : incoming;
    const produced = event(value, base);
    if (produced) events.push(produced);
    appliedSubjects.push(subject);
    if (currentChanged && incomingChanged) deduplicatedSubjects.push(subject);
  };

  for (const id of nodeIds) {
    const base = baseNodes.get(id);
    const current = currentNodes.get(id);
    const incoming = incomingNodes.get(id);
    const baseValue = semanticNode(base);
    const currentValue = semanticNode(current);
    const incomingValue = semanticNode(incoming);
    const currentChanged = !equal(currentValue, baseValue);
    const incomingChanged = !equal(incomingValue, baseValue);

    if (currentChanged && incomingChanged && !equal(currentValue, incomingValue)) {
      const previous = parsed.base.graph.nodes
        .filter(
          (node) =>
            isUnresolvedMergeContradiction(node) &&
            mergeContradictionSubject(node) === id,
        )
        .sort((left, right) => left.id.localeCompare(right.id))
        .at(-1);
      const conflictCode =
        (isDeletedNode(current) || isDeletedNode(incoming)) && baseValue
          ? "NODE_DELETE_MODIFY_CONFLICT"
          : baseValue
            ? "NODE_REVISION_CONFLICT"
            : "NODE_ADD_ADD_CONFLICT";
      const contradiction = conflictNode({
        subject: id,
        base,
        current,
        incoming,
        inputDigests: normalizedInputDigests,
        diagnosticCode: conflictCode,
      });
      conflicts.set(id, contradiction);
      nodeConflictSubjects.add(id);
      createdConflictIds.push(contradiction.id);
      if (previous) supersededBy.set(contradiction.id, previous);
      diagnostics.push({
        code: conflictCode,
        message: `Current and incoming branches changed ${id} differently; ancestor value remains active`,
        subject: id,
      });
      continue;
    }

    if (!currentChanged && !incomingChanged) continue;
    const values = [
      currentChanged ? current : undefined,
      incomingChanged ? incoming : undefined,
    ].filter((value): value is Node => value !== undefined);
    const value =
      currentChanged && incomingChanged
        ? [current, incoming].sort((left, right) =>
            canonicalJson(left).localeCompare(canonicalJson(right)),
          )[0]
        : values[0];
    const produced = value
      ? { kind: "node" as const, node: value }
      : base
        ? { kind: "node" as const, node: nodeRemoval(base) }
        : undefined;
    if (produced) events.push(produced);
    appliedSubjects.push(id);
    if (currentChanged && incomingChanged) deduplicatedSubjects.push(id);
  }
  for (const key of edgeKeys) {
    const [source, , target] = key.split("\u0000");
    const baseState = edgeStateFor(baseEdgeStates, key);
    const currentState = edgeStateFor(currentEdgeStates, key);
    const incomingState = edgeStateFor(incomingEdgeStates, key);
    const currentChanged = !equal(currentState, baseState);
    const incomingChanged = !equal(incomingState, baseState);
    const conflictedNewNode = [source, target].find(
      (id) => conflicts.has(id) && !baseNodes.has(id),
    );
    if (conflictedNewNode) {
      const contradiction = conflicts.get(conflictedNewNode) as Node;
      const quarantined = nodeFields(contradiction).quarantined as Quarantine;
      for (const [sourceName, state] of [
        ["current", currentState],
        ["incoming", incomingState],
      ] as const) {
        const changed = sourceName === "current" ? currentChanged : incomingChanged;
        if (!changed || state.operation === "absent") continue;
        quarantined.edges.push({
          source: sourceName,
          source_label: sourceLabels[sourceName],
          source_digest: normalizedInputDigests[sourceName],
          operation: state.operation,
          value: state.value,
        });
      }
      if (quarantined.edges.length > 0) quarantineEdge(key);
      continue;
    }
    if (currentChanged && incomingChanged && !equal(currentState, incomingState)) {
      const contradiction = edgeConflictNode({
        subject: key.replaceAll("\u0000", ":"),
        base: baseState,
        current: currentState,
        incoming: incomingState,
        inputDigests: normalizedInputDigests,
      });
      conflicts.set(key, contradiction);
      createdConflictIds.push(contradiction.id);
      quarantineEdge(key);
      diagnostics.push({
        code: "EDGE_STATE_CONFLICT",
        message: `Current and incoming branches changed ${key.replaceAll("\u0000", ":")} differently; ancestor edge state remains active`,
        subject: key.replaceAll("\u0000", ":"),
      });
      continue;
    }
    if (!currentChanged && !incomingChanged) continue;
    const state = currentChanged ? currentState : incomingState;
    const produced = edgeEventFor(state, baseState);
    if (produced) events.push(produced);
    appliedSubjects.push(key.replaceAll("\u0000", ":"));
    if (currentChanged && incomingChanged) {
      deduplicatedSubjects.push(key.replaceAll("\u0000", ":"));
    }
  }

  if (diagnostics.some(({ code }) => code === "INCOMPATIBLE_BRANCH_CHANGE")) {
    return failure(normalizedInputDigests, inputs.current, diagnostics);
  }

  const quarantineFor = (node: Node): Quarantine =>
    nodeFields(node).quarantined as Quarantine;
  const addNodeStates = (owner: Node, id: string): void => {
    const quarantined = quarantineFor(owner);
    const baseValue = semanticNode(baseNodes.get(id));
    for (const [sourceName, nodes] of [
      ["current", currentNodes],
      ["incoming", incomingNodes],
    ] as const) {
      const value = nodes.get(id);
      if (!value || equal(semanticNode(value), baseValue)) continue;
      quarantined.nodes.push({
        source: sourceName,
        source_label: sourceLabels[sourceName],
        source_digest: normalizedInputDigests[sourceName],
        operation: isDeletedNode(value) ? "delete" : "present",
        value,
      });
      quarantineNode(id);
    }
  };
  const addEdgeStates = (owner: Node, key: string): void => {
    const quarantined = quarantineFor(owner);
    const baseState = edgeStateFor(baseEdgeStates, key);
    for (const [sourceName, states] of [
      ["current", currentEdgeStates],
      ["incoming", incomingEdgeStates],
    ] as const) {
      const state = edgeStateFor(states, key);
      if (equal(state, baseState)) continue;
      const value = state.operation === "absent"
        ? baseState.operation === "present" ? baseState.value : undefined
        : state.value;
      if (!value) continue;
      quarantined.edges.push({
        source: sourceName,
        source_label: sourceLabels[sourceName],
        source_digest: normalizedInputDigests[sourceName],
        operation: state.operation === "present" ? "present" : "delete",
        value,
      });
      quarantineEdge(key);
    }
  };
  const eventSubject = (event: GraphEvent): string =>
    event.kind === "node" ? `node:${event.node.id}` : `edge:${edgeSubject(event.edge)}`;
  const causalTypes = new Set(["depends_on", "derived_from", "supports", "invalidates"]);
  const causalCandidate = materialize([
    ...parsed.base.events,
    ...events,
  ]);
  const causalAdjacency = buildInfluenceAdjacency(activeGraph(causalCandidate));
  const causalOwners = new Map<string, string>();
  for (const root of [...nodeConflictSubjects].sort((left, right) => left.localeCompare(right))) {
    const reachable = new Set<string>([root]);
    const queue = [root];
    for (let index = 0; index < queue.length; index += 1) {
      const id = queue[index];
      for (const neighbor of causalAdjacency.get(id) ?? []) {
        if (reachable.has(neighbor.id)) continue;
        reachable.add(neighbor.id);
        queue.push(neighbor.id);
      }
    }
    for (const event of events) {
      const subject = eventSubject(event);
      if (causalOwners.has(subject)) continue;
      if (
        event.kind === "node" &&
        event.node.id !== root &&
        nodeIds.includes(event.node.id) &&
        reachable.has(event.node.id)
      ) {
        causalOwners.set(subject, root);
      } else if (
        event.kind === "edge" &&
        causalTypes.has(event.edge.type) &&
        (reachable.has(event.edge.source) || reachable.has(event.edge.target))
      ) {
        causalOwners.set(subject, root);
      }
    }
  }
  for (const [subject, root] of causalOwners) {
    const owner = conflicts.get(root);
    if (!owner) continue;
    quarantinedEventSubjects.add(subject);
    if (subject.startsWith("node:")) addNodeStates(owner, subject.slice("node:".length));
    else addEdgeStates(owner, subject.slice("edge:".length).replaceAll(":", "\u0000"));
  }

  const selectedEvents = (): GraphEvent[] =>
    events.filter((event) => !quarantinedEventSubjects.has(eventSubject(event)));
  const topologyCandidate = materialize([
    ...parsed.base.events,
    ...selectedEvents(),
  ]);
  const topologyValidation = validateGraph(activeGraph(topologyCandidate));
  if (!topologyValidation.valid) {
    const topologyNodeIds = new Set<string>();
    const topologyEdgeKeys = new Set<string>();
    for (const diagnostic of topologyValidation.diagnostics) {
      for (const id of diagnostic.path ?? []) topologyNodeIds.add(id);
      const edge = diagnostic.edge;
      if (edge?.source && edge.target && edge.type) {
        topologyNodeIds.add(edge.source);
        topologyNodeIds.add(edge.target);
        topologyEdgeKeys.add(`${edge.source}\u0000${edge.type}\u0000${edge.target}`);
      }
      if (diagnostic.nodeId) topologyNodeIds.add(diagnostic.nodeId);
    }
    for (const node of topologyCandidate.nodes) {
      for (const dependency of node.dependencies ?? []) {
        if (topologyNodeIds.has(dependency)) topologyNodeIds.add(node.id);
      }
    }
    for (const edge of topologyCandidate.edges) {
      if (
        causalTypes.has(edge.type) &&
        topologyNodeIds.has(edge.source) &&
        topologyNodeIds.has(edge.target)
      ) {
        topologyEdgeKeys.add(edgeSubject(edge).replaceAll(":", "\u0000"));
      }
    }
    if (topologyNodeIds.size === 0 && topologyEdgeKeys.size === 0) {
      return failure(
        normalizedInputDigests,
        inputs.current,
        topologyValidation.diagnostics.map((item) => diagnosticFromGraph("base", item)),
      );
    }
    const topologySubject = `topology:${[...topologyNodeIds].sort((left, right) => left.localeCompare(right)).join(",")}|${[...topologyEdgeKeys].sort((left, right) => left.localeCompare(right)).join(",")}`;
    const quarantined: Quarantine = { nodes: [], edges: [] };
    for (const id of topologyNodeIds) {
      for (const [sourceName, nodes] of [
        ["current", currentNodes],
        ["incoming", incomingNodes],
      ] as const) {
        const value = nodes.get(id);
        if (!value || equal(semanticNode(value), semanticNode(baseNodes.get(id)))) continue;
        quarantined.nodes.push({
          source: sourceName,
          source_label: sourceLabels[sourceName],
          source_digest: normalizedInputDigests[sourceName],
          operation: isDeletedNode(value) ? "delete" : "present",
          value,
        });
        quarantineNode(id);
        quarantinedEventSubjects.add(`node:${id}`);
      }
    }
    for (const key of topologyEdgeKeys) {
      const edgeSubjectKey = key.replaceAll("\u0000", ":");
      for (const [sourceName, states] of [
        ["current", currentEdgeStates],
        ["incoming", incomingEdgeStates],
      ] as const) {
        const state = edgeStateFor(states, edgeSubjectKey);
        const baseState = edgeStateFor(baseEdgeStates, edgeSubjectKey);
        if (equal(state, baseState)) continue;
        const value = state.operation === "absent"
          ? baseState.operation === "present" ? baseState.value : undefined
          : state.value;
        if (!value) continue;
        quarantined.edges.push({
          source: sourceName,
          source_label: sourceLabels[sourceName],
          source_digest: normalizedInputDigests[sourceName],
          operation: state.operation === "present" ? "present" : "delete",
          value,
        });
        quarantineEdge(key);
        quarantinedEventSubjects.add(`edge:${edgeSubject(value)}`);
      }
    }
    const code = topologyValidation.diagnostics.some(({ code: diagnosticCode }) => diagnosticCode === "CYCLE")
      ? "TOPOLOGY_CYCLE"
      : topologyValidation.diagnostics.some(({ code: diagnosticCode }) => diagnosticCode === "INVALID_EDGE")
        ? "TOPOLOGY_INVALID_ENDPOINT"
        : "TOPOLOGY_DANGLING_REFERENCE";
    const contradiction = topologyConflictNode({
      subject: topologySubject,
      diagnosticCodes: [code],
      quarantined,
      inputDigests: normalizedInputDigests,
    });
    conflicts.set(topologySubject, contradiction);
    createdConflictIds.push(contradiction.id);
    diagnostics.push({
      code,
      message: `Merged branch changes create an invalid topology for ${topologySubject}`,
      subject: topologySubject,
    });
  }

  const finalEvents = selectedEvents();
  for (const contradiction of conflicts.values()) {
    if (!baseNodes.has(contradiction.id)) finalEvents.push({ kind: "node", node: contradiction });
    const previous = supersededBy.get(contradiction.id);
    if (previous) {
      const supersedes = { source: contradiction.id, type: "supersedes" as const, target: previous.id };
      if (!baseEdges.has(edgeSubject(supersedes))) finalEvents.push({ kind: "edge", edge: supersedes });
    }
  }

  if (quarantineCeilingSubjects.size > limits.maxQuarantinedSubjects) {
    return failure(normalizedInputDigests, inputs.current, [
      ...diagnostics,
      {
        code: "QUARANTINE_CEILING_EXCEEDED",
        message: `Merged branch changes exceed the ${limits.maxQuarantinedSubjects}-subject quarantine ceiling`,
      },
    ]);
  }

  finalEvents.sort((left, right) => {
    const leftSubject = left.kind === "node" ? left.node.id : edgeSubject(left.edge);
    const rightSubject = right.kind === "node" ? right.node.id : edgeSubject(right.edge);
    return `${left.kind === "node" ? "0" : "1"}:${leftSubject}`.localeCompare(
      `${right.kind === "node" ? "0" : "1"}:${rightSubject}`,
    );
  });
  const suffix = finalEvents.map(canonicalJson).join("\n");
  const output = suffix
    ? `${inputs.base}${inputs.base.endsWith("\n") ? "" : "\n"}${suffix}\n`
    : inputs.base;
  const merged = materialize([...parsed.base.events, ...finalEvents]);
  const mergedValidation = validateGraph(activeGraph(merged));
  if (!mergedValidation.valid) {
    return failure(
      normalizedInputDigests,
      inputs.current,
      mergedValidation.diagnostics.map((item) => diagnosticFromGraph("base", item)),
    );
  }

  const outcome: MergeOutcome = conflicts.size > 0 ? "DIVERGED" : "CLEAN";
  return {
    output,
    receipt: {
      outcome,
      merge_protocol_version: MERGE_PROTOCOL_VERSION,
      source_labels: sourceLabels,
      input_digests: normalizedInputDigests,
      output_digest: digest(output),
      applied_subjects: [...new Set(appliedSubjects)].sort((left, right) => left.localeCompare(right)),
      deduplicated_subjects: [...new Set(deduplicatedSubjects)].sort((left, right) => left.localeCompare(right)),
      created_conflict_ids: [...new Set(createdConflictIds)].sort((left, right) => left.localeCompare(right)),
      quarantined_subjects: [...quarantinedSubjects].sort((left, right) => left.localeCompare(right)),
      diagnostics,
      deterministic_detection_coverage: coverage,
      post_merge_verification_requirement: null,
    },
  };
}

export const mergeThreeWay = mergeBranchModels;
