import { createHash } from "node:crypto";
import { EdgeSchema, type EpistemicEdge } from "../core/schemas/edges.js";
import { NodeSchema, type Node } from "../core/schemas/nodes.js";
import { EpistemicGateEngine } from "../gates/gate-engine.js";
import {
  EpistemicDeltaSchema,
  extractDeltaBlocks,
  type EpistemicDelta,
} from "../multiagent/delta.js";
import type { EpistemicGraph } from "../graph/epistemic-graph.js";
import {
  applyEvents,
  edgeKey,
  type GraphEvent,
  type MaterializedGraph,
} from "../graph/domain.js";
import { validateGraph } from "../graph/integrity.js";
import { canonicalJson, isUnresolvedMergeContradiction } from "./three-way.js";

export type MergeReconciliationOutcome =
  "RESOLVED" | "REJECTED" | "STALE" | "ALREADY_RESOLVED";

export type MergeReconciliationDiagnostic = {
  code: string;
  message: string;
  subject?: string;
};

export type MergeReconciliationReceipt = {
  outcome: MergeReconciliationOutcome;
  conflict_id: string;
  expected_conflict_digest: string;
  actual_conflict_digest: string | null;
  resolution_mode: "base" | "variant" | "delta" | null;
  applied_subjects: string[];
  released_subjects: string[];
  diagnostics: MergeReconciliationDiagnostic[];
};

type MergeReconciliationRequestFields = {
  conflictId: string;
  expectedConflictDigest: string;
  decisionOwnerAuthorization?: string;
};

export type MergeReconciliationRequest =
  | (MergeReconciliationRequestFields & {
      selectDigest: string;
      delta?: never;
    })
  | (MergeReconciliationRequestFields & {
      selectDigest?: never;
      delta: EpistemicDelta | string;
    });

type StoredVariant = {
  source?: unknown;
  operation?: unknown;
  value?: unknown;
  variant_digest?: unknown;
};

type QuarantineEntry = {
  source?: unknown;
  operation?: unknown;
  value?: unknown;
};

type QuarantineEntries = {
  nodes: QuarantineEntry[];
  edges: QuarantineEntry[];
};

const digest = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const nodeFields = (node: Node): Record<string, unknown> =>
  node as unknown as Record<string, unknown>;

const edgeSubject = (
  edge: Pick<EpistemicEdge, "source" | "type" | "target">,
): string => `${edge.source}:${edge.type}:${edge.target}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const equal = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

const isRemoved = (node: Node): boolean =>
  nodeFields(node).tombstone === true ||
  (typeof node.status === "string" && node.status.toUpperCase() === "REMOVED");

const activeGraph = (graph: MaterializedGraph): MaterializedGraph => ({
  nodes: graph.nodes.filter((node) => !isRemoved(node)),
  edges: graph.edges,
});

const storedVariants = (conflict: Node): StoredVariant[] => {
  const variants = nodeFields(conflict).variants;
  return Array.isArray(variants) ? variants.filter(isRecord) : [];
};

const storedVariantDigest = (
  variant: StoredVariant,
  kind: ReturnType<typeof subjectKind>,
): string =>
  digest(
    canonicalJson(
      kind === "edge"
        ? {
            operation:
              variant.operation === "delete" || variant.operation === "present"
                ? variant.operation
                : "absent",
            value: variant.value ?? null,
          }
        : (variant.value ?? null),
    ),
  );

const quarantine = (conflict: Node): QuarantineEntries => {
  const value = nodeFields(conflict).quarantined;
  if (!isRecord(value)) return { nodes: [], edges: [] };
  return {
    nodes: Array.isArray(value.nodes) ? value.nodes.filter(isRecord) : [],
    edges: Array.isArray(value.edges) ? value.edges.filter(isRecord) : [],
  };
};

const lockedDecision = (node: Node | undefined): boolean =>
  node?.type === "DEC" &&
  (node.provenance_type === "DECIDED" ||
    ["DECIDED", "LOCKED"].includes((node.status ?? "").toUpperCase()));

const decisionOwner = (node: Node | undefined): string | undefined => {
  if (!node) return undefined;
  const fields = nodeFields(node);
  for (const key of ["decision_owner", "decisionOwner", "owner"]) {
    if (typeof fields[key] === "string" && fields[key].trim())
      return fields[key];
  }
  return undefined;
};

const subjectKind = (
  subject: string,
): "node" | "edge" | "scope" | "topology" | "other" => {
  if (subject.startsWith("decision_scope:")) return "scope";
  if (subject.startsWith("topology:")) return "topology";
  if (subject.split(":").length === 3) return "edge";
  if (/^[A-Z][A-Z0-9-]*-[0-9A-Za-z_-]+$/u.test(subject)) return "node";
  return "other";
};

const reject = (
  request: MergeReconciliationRequest,
  diagnostics: MergeReconciliationDiagnostic[],
  conflict?: Node,
  outcome: "REJECTED" | "STALE" | "ALREADY_RESOLVED" = "REJECTED",
): MergeReconciliationReceipt => ({
  outcome,
  conflict_id: request.conflictId,
  expected_conflict_digest: request.expectedConflictDigest,
  actual_conflict_digest:
    conflict && typeof nodeFields(conflict).conflict_digest === "string"
      ? (nodeFields(conflict).conflict_digest as string)
      : null,
  resolution_mode: null,
  applied_subjects: [],
  released_subjects: [],
  diagnostics,
});

const INVALID_REQUEST_KEYS = new Set([
  "conflictId",
  "expectedConflictDigest",
  "selectDigest",
  "delta",
  "decisionOwnerAuthorization",
]);

const invalidRequestReceipt = (
  request: unknown,
  diagnostics: MergeReconciliationDiagnostic[],
): MergeReconciliationReceipt => {
  const value = isRecord(request) ? request : {};
  return {
    outcome: "REJECTED",
    conflict_id: typeof value.conflictId === "string" ? value.conflictId : "",
    expected_conflict_digest:
      typeof value.expectedConflictDigest === "string"
        ? value.expectedConflictDigest
        : "",
    actual_conflict_digest: null,
    resolution_mode: null,
    applied_subjects: [],
    released_subjects: [],
    diagnostics,
  };
};

const validateRequest = (
  request: unknown,
): MergeReconciliationDiagnostic[] => {
  if (!isRecord(request)) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_REQUEST",
      "Reconciliation request must be an object",
    );
  }
  const unknownKeys = Object.keys(request).filter(
    (key) => !INVALID_REQUEST_KEYS.has(key),
  );
  if (unknownKeys.length > 0) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_REQUEST",
      `Reconciliation request contains unsupported fields: ${unknownKeys.join(", ")}`,
    );
  }
  if (
    typeof request.conflictId !== "string" ||
    request.conflictId.trim() === ""
  ) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_REQUEST",
      "A contradiction ID is required",
    );
  }
  if (
    typeof request.expectedConflictDigest !== "string" ||
    request.expectedConflictDigest.trim() === ""
  ) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_REQUEST",
      "An expected conflict digest is required",
    );
  }
  const hasSelection = request.selectDigest !== undefined;
  const hasDelta = request.delta !== undefined;
  if (hasSelection === hasDelta) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_MODE",
      "Exactly one of stored content digest selection or ariadne-delta is required",
    );
  }
  if (
    hasSelection &&
    (typeof request.selectDigest !== "string" ||
      request.selectDigest.trim() === "")
  ) {
    return errorDiagnostics(
      "INVALID_RECONCILIATION_MODE",
      "Stored content selection must be a non-empty digest",
    );
  }
  return [];
};

const parseDelta = (
  value: unknown,
): { delta?: EpistemicDelta; error?: string } => {
  let candidate = value;
  if (typeof candidate === "string") {
    const raw = candidate;
    try {
      candidate = JSON.parse(raw);
    } catch {
      try {
        const blocks = extractDeltaBlocks(raw);
        if (blocks.length !== 1)
          return { error: "Exactly one ariadne-delta block is required" };
        return { delta: blocks[0] };
      } catch {
        return { error: "Delta must be valid JSON or one ariadne-delta block" };
      }
    }
  }
  const parsed = EpistemicDeltaSchema.safeParse(candidate);
  return parsed.success
    ? { delta: parsed.data }
    : { error: "Delta does not satisfy the ariadne-delta schema" };
};

const mutationId = (mutation: Record<string, unknown>): string | undefined => {
  const id = mutation.id ?? mutation.node_id;
  return typeof id === "string" ? id : undefined;
};

const allMutations = (delta: EpistemicDelta): Record<string, unknown>[] =>
  [
    ...(delta.mutations ?? []),
    ...(delta.updates ?? []),
    ...(delta.node_mutations ?? []),
    ...(delta.status_mutations ?? []),
    ...(delta.invalidation_mutations ?? []),
  ] as Record<string, unknown>[];

const nodeRemoval = (node: Node): Node => ({
  ...node,
  status: "REMOVED",
  tombstone: true,
});

const errorDiagnostics = (
  code: string,
  message: string,
  subject?: string,
): MergeReconciliationDiagnostic[] => [
  { code, message, ...(subject ? { subject } : {}) },
];

const addEvent = (events: GraphEvent[], event: GraphEvent): void => {
  if (
    event.kind === "node" &&
    events.some(
      (existing) =>
        existing.kind === "node" &&
        existing.node.id === event.node.id &&
        equal(existing.node, event.node),
    )
  ) {
    return;
  }
  if (
    event.kind === "edge" &&
    events.some(
      (existing) =>
        existing.kind === "edge" &&
        edgeKey(existing.edge) === edgeKey(event.edge) &&
        existing.tombstone === event.tombstone,
    )
  ) {
    return;
  }
  events.push(event);
};

const deltaTouchesConflict = (
  conflict: Node,
  delta: EpistemicDelta,
  quarantined: QuarantineEntries,
): boolean => {
  const subject = nodeFields(conflict).subject_key;
  if (typeof subject !== "string") return false;
  const kind = subjectKind(subject);
  const mutations = allMutations(delta).map(mutationId);
  if (kind === "node") {
    return (
      delta.nodes.some((node) => node.id === subject) ||
      mutations.includes(subject)
    );
  }
  if (kind === "edge") {
    return delta.edges.some((edge) => edgeSubject(edge) === subject);
  }
  if (kind === "scope") {
    const scope = subject.slice("decision_scope:".length);
    const decisionIds = new Set(
      quarantined.nodes.flatMap((entry) => {
        const value = NodeSchema.safeParse(entry.value);
        return value.success &&
          value.data.type === "DEC" &&
          nodeFields(value.data).decision_scope === scope
          ? [value.data.id]
          : [];
      }),
    );
    const base = NodeSchema.safeParse(nodeFields(conflict).base_value);
    if (
      base.success &&
      base.data.type === "DEC" &&
      nodeFields(base.data).decision_scope === scope
    ) {
      decisionIds.add(base.data.id);
    }
    return (
      delta.nodes.some(
        (node) =>
          node.type === "DEC" && nodeFields(node).decision_scope === scope,
      ) || mutations.some((id) => id !== undefined && decisionIds.has(id))
    );
  }

  const quarantinedIds = new Set(
    quarantined.nodes.flatMap((entry) => {
      const value = NodeSchema.safeParse(entry.value);
      return value.success ? [value.data.id] : [];
    }),
  );
  const quarantinedEdges = new Set(
    quarantined.edges.flatMap((entry) => {
      const value = EdgeSchema.safeParse(entry.value);
      return value.success ? [edgeSubject(value.data)] : [];
    }),
  );
  const subjectIds = new Set(
    subject.slice("topology:".length).split(/[|,]/u).filter(Boolean),
  );
  return (
    delta.nodes.some(
      (node) => quarantinedIds.has(node.id) || subjectIds.has(node.id),
    ) ||
    mutations.some(
      (id) =>
        id !== undefined && (quarantinedIds.has(id) || subjectIds.has(id)),
    ) ||
    delta.edges.some(
      (edge) =>
        quarantinedEdges.has(edgeSubject(edge)) ||
        subjectIds.has(edge.source) ||
        subjectIds.has(edge.target),
    )
  );
};

const applyDelta = (
  current: MaterializedGraph,
  conflict: Node,
  delta: EpistemicDelta,
): { events?: GraphEvent[]; diagnostics?: MergeReconciliationDiagnostic[] } => {
  const subject = nodeFields(conflict).subject_key;
  const allowedExisting = new Set<string>(
    typeof subject === "string" ? [subject] : [],
  );
  const quarantined = quarantine(conflict);
  for (const entry of quarantined.nodes) {
    const parsed = NodeSchema.safeParse(entry.value);
    if (parsed.success) allowedExisting.add(parsed.data.id);
  }
  if (typeof subject === "string" && subject.startsWith("decision_scope:")) {
    const scope = subject.slice("decision_scope:".length);
    for (const node of current.nodes) {
      if (node.type === "DEC" && nodeFields(node).decision_scope === scope) {
        allowedExisting.add(node.id);
      }
    }
  }

  const currentNodes = new Map(current.nodes.map((node) => [node.id, node]));
  const currentEdges = new Map(
    current.edges.map((edge) => [edgeKey(edge), edge]),
  );
  const events: GraphEvent[] = [];
  for (const node of delta.nodes) {
    const previous = currentNodes.get(node.id);
    if (previous && !equal(previous, node) && !allowedExisting.has(node.id)) {
      return {
        diagnostics: errorDiagnostics(
          "DELTA_EXISTING_NODE_CONFLICT",
          `Delta cannot replace unrelated existing node ${node.id}`,
          node.id,
        ),
      };
    }
    if (!previous || !equal(previous, node)) {
      currentNodes.set(node.id, node);
      addEvent(events, { kind: "node", node });
    }
  }

  for (const mutation of allMutations(delta)) {
    const id = mutationId(mutation);
    if (!id)
      return {
        diagnostics: errorDiagnostics(
          "INVALID_DELTA",
          "Delta mutation has no node id",
        ),
      };
    const previous = currentNodes.get(id);
    if (!previous) {
      return {
        diagnostics: errorDiagnostics(
          "DELTA_MISSING_NODE",
          `Cannot mutate missing node ${id}`,
          id,
        ),
      };
    }
    if (
      (previous.status ?? null) !== (mutation.expected_status as string | null)
    ) {
      return {
        diagnostics: errorDiagnostics(
          "DELTA_STATUS_CONFLICT",
          `Delta expected ${String(mutation.expected_status)} for ${id}, found ${String(previous.status ?? null)}`,
          id,
        ),
      };
    }
    const next: Record<string, unknown> = { ...previous };
    if (typeof mutation.status === "string") next.status = mutation.status;
    if (isRecord(mutation.invalidation))
      next.invalidation = mutation.invalidation;
    if (isRecord(mutation.invalidation_metadata)) {
      next.invalidation = mutation.invalidation_metadata;
    }
    const parsed = NodeSchema.safeParse(next);
    if (!parsed.success) {
      return {
        diagnostics: errorDiagnostics(
          "INVALID_DELTA_NODE",
          `Delta mutation invalidates ${id}`,
          id,
        ),
      };
    }
    if (!equal(previous, parsed.data)) {
      currentNodes.set(id, parsed.data);
      addEvent(events, { kind: "node", node: parsed.data });
    }
  }

  for (const edge of delta.edges) {
    const key = edgeKey(edge);
    if (!currentEdges.has(key)) {
      currentEdges.set(key, edge);
      addEvent(events, { kind: "edge", edge });
    }
  }
  return { events };
};

const releaseQuarantine = (
  current: MaterializedGraph,
  events: GraphEvent[],
  entries: QuarantineEntries,
): { released: string[]; diagnostics?: MergeReconciliationDiagnostic[] } => {
  let working = applyEvents(current, events);
  const released: string[] = [];

  const nodeEntries = [...entries.nodes].sort((left, right) =>
    String((left.value as { id?: unknown })?.id).localeCompare(
      String((right.value as { id?: unknown })?.id),
    ),
  );
  const edgeEntries = [...entries.edges].sort((left, right) => {
    const leftEdge = EdgeSchema.safeParse(left.value);
    const rightEdge = EdgeSchema.safeParse(right.value);
    return String(
      leftEdge.success ? edgeSubject(leftEdge.data) : left.value,
    ).localeCompare(
      String(rightEdge.success ? edgeSubject(rightEdge.data) : right.value),
    );
  });

  for (const entry of nodeEntries) {
    const parsed = NodeSchema.safeParse(entry.value);
    if (
      !parsed.success ||
      (entry.operation !== "present" && entry.operation !== "delete")
    ) {
      return {
        released: [],
        diagnostics: errorDiagnostics(
          "INVALID_QUARANTINE",
          "Quarantined node is invalid",
        ),
      };
    }
  }
  for (const entry of edgeEntries) {
    const parsed = EdgeSchema.safeParse(entry.value);
    if (
      !parsed.success ||
      (entry.operation !== "present" && entry.operation !== "delete")
    ) {
      return {
        released: [],
        diagnostics: errorDiagnostics(
          "INVALID_QUARANTINE",
          "Quarantined edge is invalid",
        ),
      };
    }
  }

  const ambiguousNodeIds = new Set<string>();
  for (const entry of nodeEntries) {
    const node = NodeSchema.parse(entry.value);
    const sameSubject = nodeEntries.filter((candidate) => {
      const value = NodeSchema.parse(candidate.value);
      return value.id === node.id;
    });
    if (
      new Set(
        sameSubject.map((candidate) =>
          canonicalJson(
            candidate.operation === "delete"
              ? nodeRemoval(NodeSchema.parse(candidate.value))
              : NodeSchema.parse(candidate.value),
          ),
        ),
      ).size > 1
    ) {
      ambiguousNodeIds.add(node.id);
    }
  }
  const ambiguousEdgeKeys = new Set<string>();
  for (const entry of edgeEntries) {
    const edge = EdgeSchema.parse(entry.value);
    const key = edgeKey(edge);
    const sameSubject = edgeEntries.filter(
      (candidate) => edgeKey(EdgeSchema.parse(candidate.value)) === key,
    );
    if (
      new Set(
        sameSubject.map((candidate) =>
          canonicalJson({
            operation: candidate.operation,
            value: EdgeSchema.parse(candidate.value),
          }),
        ),
      ).size > 1
    ) {
      ambiguousEdgeKeys.add(key);
    }
  }

  const isValidProspective = (graph: MaterializedGraph): boolean =>
    validateGraph(graph).valid && validateGraph(activeGraph(graph)).valid;

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (let index = 0; index < nodeEntries.length; index += 1) {
      const entry = nodeEntries[index];
      const node = NodeSchema.parse(entry.value);
      if (ambiguousNodeIds.has(node.id)) continue;
      const candidateNode =
        entry.operation === "delete" ? nodeRemoval(node) : node;
      const previous = working.nodes.find(({ id }) => id === node.id);
      if (previous && equal(previous, candidateNode)) {
        nodeEntries.splice(index, 1);
        index -= 1;
        progressed = true;
        continue;
      }
      const event: GraphEvent = { kind: "node", node: candidateNode };
      const candidate = applyEvents(working, [event]);
      if (!isValidProspective(candidate)) continue;
      working = candidate;
      addEvent(events, event);
      released.push(node.id);
      nodeEntries.splice(index, 1);
      index -= 1;
      progressed = true;
    }
    for (let index = 0; index < edgeEntries.length; index += 1) {
      const entry = edgeEntries[index];
      const edge = EdgeSchema.parse(entry.value);
      const key = edgeKey(edge);
      if (ambiguousEdgeKeys.has(key)) continue;
      const present = working.edges.some(
        (candidate) => edgeKey(candidate) === key,
      );
      if (
        (entry.operation === "present" && present) ||
        (entry.operation === "delete" && !present)
      ) {
        edgeEntries.splice(index, 1);
        index -= 1;
        progressed = true;
        continue;
      }
      const event: GraphEvent =
        entry.operation === "delete"
          ? { kind: "edge", edge, tombstone: true }
          : { kind: "edge", edge };
      const candidate = applyEvents(working, [event]);
      if (!isValidProspective(candidate)) continue;
      working = candidate;
      addEvent(events, event);
      released.push(edgeSubject(edge));
      edgeEntries.splice(index, 1);
      index -= 1;
      progressed = true;
    }
  }
  return { released };
};

const authorityDiagnostics = (
  changedDecisions: Node[],
  authorization: string | undefined,
): MergeReconciliationDiagnostic[] => {
  if (changedDecisions.length === 0) return [];
  if (!(typeof authorization === "string" && authorization.trim())) {
    return errorDiagnostics(
      "MISSING_DECISION_OWNER_AUTHORIZATION",
      "Changing a locked decision requires explicit decision-owner authorization",
    );
  }
  const declaredOwners = changedDecisions
    .map(decisionOwner)
    .filter((owner): owner is string => owner !== undefined);
  if (declaredOwners.length > 0 && !declaredOwners.includes(authorization)) {
    return errorDiagnostics(
      "DECISION_OWNER_MISMATCH",
      `Authorization does not match the declared decision owner (${declaredOwners.join(", ")})`,
    );
  }
  return [];
};

const evidenceDiagnostics = (
  before: MaterializedGraph,
  after: MaterializedGraph,
): MergeReconciliationDiagnostic[] => {
  const existing = new Set(
    EpistemicGateEngine.verifyEpistemic(before).diagnostics.map(canonicalJson),
  );
  return EpistemicGateEngine.verifyEpistemic(after)
    .diagnostics.filter(
      (diagnostic) => !existing.has(canonicalJson(diagnostic)),
    )
    .map(({ code, message, nodeId }) => ({
      code,
      message,
      ...(typeof nodeId === "string" ? { subject: nodeId } : {}),
    }));
};

const resolvedConflict = (
  conflict: Node,
  request: MergeReconciliationRequest,
  mode: "base" | "variant" | "delta",
): Node =>
  NodeSchema.parse({
    ...nodeFields(conflict),
    status: "RESOLVED",
    resolution_mode: mode,
    resolved_from_conflict_digest: nodeFields(conflict).conflict_digest,
    resolved_selection_digest: request.selectDigest ?? null,
    resolution_authorized: request.decisionOwnerAuthorization !== undefined,
  });

export async function reconcileMergeContradiction(
  graph: Pick<EpistemicGraph, "batch">,
  request: MergeReconciliationRequest,
): Promise<MergeReconciliationReceipt> {
  const requestDiagnostics = validateRequest(request);
  if (requestDiagnostics.length > 0) {
    return invalidRequestReceipt(request, requestDiagnostics);
  }

  return graph.batch((batch) => {
    const current = batch.graph;
    const conflict = current.nodes.find(
      (node) => node.id === request.conflictId,
    );
    if (!conflict) {
      return reject(
        request,
        errorDiagnostics(
          "CONFLICT_NOT_FOUND",
          `Merge contradiction not found: ${request.conflictId}`,
        ),
      );
    }
    if (
      conflict.type !== "CTR" ||
      nodeFields(conflict).conflict_kind !== "branch_merge"
    ) {
      return reject(
        request,
        errorDiagnostics(
          "INVALID_CONFLICT_ID",
          `Node ${request.conflictId} is not a merge contradiction`,
        ),
        conflict,
      );
    }
    if (!isUnresolvedMergeContradiction(conflict)) {
      return reject(
        request,
        errorDiagnostics(
          "CONFLICT_ALREADY_RESOLVED",
          `Merge contradiction ${request.conflictId} is already resolved`,
        ),
        conflict,
        "ALREADY_RESOLVED",
      );
    }

    const actualDigest = nodeFields(conflict).conflict_digest;
    if (
      typeof actualDigest !== "string" ||
      actualDigest !== request.expectedConflictDigest
    ) {
      return reject(
        request,
        errorDiagnostics(
          "STALE_EXPECTED_CONFLICT_DIGEST",
          "Expected conflict digest does not match the current contradiction",
        ),
        conflict,
        "STALE",
      );
    }

    const hasSelection = request.selectDigest !== undefined;
    const hasDelta = request.delta !== undefined;
    if (hasSelection === hasDelta) {
      return reject(
        request,
        errorDiagnostics(
          "INVALID_RECONCILIATION_MODE",
          "Exactly one of stored content digest selection or ariadne-delta is required",
        ),
        conflict,
      );
    }

    const stored = storedVariants(conflict);
    let mode: "base" | "variant" | "delta";
    let selected: StoredVariant | undefined;
    let delta: EpistemicDelta | undefined;
    if (hasSelection) {
      const baseDigest = nodeFields(conflict).base_digest;
      if (request.selectDigest === baseDigest) {
        if (
          typeof baseDigest !== "string" ||
          baseDigest !== digest(canonicalJson(nodeFields(conflict).base_value ?? null))
        ) {
          return reject(
            request,
            errorDiagnostics(
              "INVALID_BASE_DIGEST",
              "Stored base digest does not match the stored base content",
            ),
            conflict,
          );
        }
        mode = "base";
      } else {
        const matches = stored.filter(
          (variant) => variant.variant_digest === request.selectDigest,
        );
        if (matches.length !== 1) {
          return reject(
            request,
            errorDiagnostics(
              matches.length > 1
                ? "AMBIGUOUS_VARIANT_DIGEST"
                : "UNKNOWN_VARIANT_DIGEST",
              "Selection must match the stored base or exactly one stored variant content digest",
            ),
            conflict,
          );
        }
        selected = matches[0];
        const kind =
          typeof nodeFields(conflict).subject_key === "string"
            ? subjectKind(nodeFields(conflict).subject_key as string)
            : "other";
        if (storedVariantDigest(selected, kind) !== request.selectDigest) {
          return reject(
            request,
            errorDiagnostics(
              "INVALID_VARIANT_DIGEST",
              "Stored variant digest does not match the stored variant content",
            ),
            conflict,
          );
        }
        mode = "variant";
      }
    } else {
      const parsed = parseDelta(request.delta);
      if (!parsed.delta) {
        return reject(
          request,
          errorDiagnostics(
            "INVALID_DELTA",
            parsed.error ?? "Invalid ariadne-delta",
          ),
          conflict,
        );
      }
      delta = parsed.delta;
      mode = "delta";
    }

    const entries = quarantine(conflict);
    const events: GraphEvent[] = [];
    const appliedSubjects: string[] = [];
    const changedDecisions: Node[] = [];
    const subject = nodeFields(conflict).subject_key;
    const baseValue = nodeFields(conflict).base_value;

    if (mode === "variant" || mode === "base") {
      const value = mode === "variant" ? selected?.value : baseValue;
      const parsedNode = NodeSchema.safeParse(value);
      const parsedEdge = EdgeSchema.safeParse(value);
      const kind = typeof subject === "string" ? subjectKind(subject) : "other";
      if (parsedNode.success && (kind === "node" || kind === "scope")) {
        const matchesSubject =
          (kind === "node" && parsedNode.data.id === subject) ||
          (kind === "scope" &&
            parsedNode.data.type === "DEC" &&
            nodeFields(parsedNode.data).decision_scope ===
              (subject as string).slice("decision_scope:".length));
        if (!matchesSubject) {
          return reject(
            request,
            errorDiagnostics(
              "INVALID_STORED_VALUE",
              "Stored resolution value does not match the contradiction subject",
              typeof subject === "string" ? subject : undefined,
            ),
            conflict,
          );
        }
        const currentNode = current.nodes.find(
          (node) => node.id === parsedNode.data.id,
        );
        if (currentNode && !equal(currentNode, parsedNode.data)) {
          if (lockedDecision(currentNode)) changedDecisions.push(currentNode);
          addEvent(events, { kind: "node", node: parsedNode.data });
        } else if (!currentNode) {
          addEvent(events, { kind: "node", node: parsedNode.data });
        }
        if (lockedDecision(parsedNode.data) && mode === "variant")
          changedDecisions.push(parsedNode.data);
        appliedSubjects.push(parsedNode.data.id);

        if (kind === "scope") {
          const scope = (subject as string).slice("decision_scope:".length);
          for (const node of current.nodes) {
            if (
              node.id !== parsedNode.data.id &&
              node.type === "DEC" &&
              nodeFields(node).decision_scope === scope &&
              !isRemoved(node)
            ) {
              if (lockedDecision(node)) changedDecisions.push(node);
              addEvent(events, { kind: "node", node: nodeRemoval(node) });
              appliedSubjects.push(node.id);
            }
          }
        }
      } else if (parsedEdge.success && kind === "edge") {
        if (edgeSubject(parsedEdge.data) !== subject) {
          return reject(
            request,
            errorDiagnostics(
              "INVALID_STORED_VALUE",
              "Stored resolution value does not match the contradiction subject",
              typeof subject === "string" ? subject : undefined,
            ),
            conflict,
          );
        }
        const operation = mode === "variant" ? selected?.operation : "present";
        const key = edgeKey(parsedEdge.data);
        if (operation === "delete" || operation === "absent") {
          if (current.edges.some((edge) => edgeKey(edge) === key)) {
            addEvent(events, {
              kind: "edge",
              edge: parsedEdge.data,
              tombstone: true,
            });
            appliedSubjects.push(edgeSubject(parsedEdge.data));
          }
        } else if (!current.edges.some((edge) => edgeKey(edge) === key)) {
          addEvent(events, { kind: "edge", edge: parsedEdge.data });
          appliedSubjects.push(edgeSubject(parsedEdge.data));
        }
      } else if (value !== null && value !== undefined) {
        return reject(
          request,
          errorDiagnostics(
            "INVALID_STORED_VALUE",
            "Stored resolution value is not a valid node or edge",
            typeof subject === "string" ? subject : undefined,
          ),
          conflict,
        );
      }
    } else if (delta) {
      if (!deltaTouchesConflict(conflict, delta, entries)) {
        return reject(
          request,
          errorDiagnostics(
            "DELTA_DOES_NOT_RESOLVE_CONFLICT",
            "The ariadne-delta does not change the contradiction subject",
            typeof subject === "string" ? subject : undefined,
          ),
          conflict,
        );
      }
      const applied = applyDelta(current, conflict, delta);
      if (!applied.events) {
        return reject(
          request,
          applied.diagnostics ??
            errorDiagnostics("INVALID_DELTA", "Invalid ariadne-delta"),
          conflict,
        );
      }
      events.push(...applied.events);
      for (const event of applied.events) {
        if (event.kind === "node") {
          appliedSubjects.push(event.node.id);
          const previous = current.nodes.find(
            (node) => node.id === event.node.id,
          );
          if (lockedDecision(previous) || lockedDecision(event.node)) {
            changedDecisions.push(previous ?? event.node);
          }
        } else {
          appliedSubjects.push(edgeSubject(event.edge));
        }
      }
    }

    const conflictSubject = typeof subject === "string" ? subject : undefined;
    const isRootEntry = (entry: QuarantineEntry): boolean => {
      if (!conflictSubject || conflictSubject.startsWith("topology:"))
        return false;
      const node = NodeSchema.safeParse(entry.value);
      if (node.success) {
        if (subjectKind(conflictSubject) === "node")
          return node.data.id === conflictSubject;
        if (subjectKind(conflictSubject) === "scope") {
          return (
            nodeFields(node.data).decision_scope ===
            conflictSubject.slice("decision_scope:".length)
          );
        }
      }
      const edge = EdgeSchema.safeParse(entry.value);
      return (
        subjectKind(conflictSubject) === "edge" &&
        edge.success &&
        edgeSubject(edge.data) === conflictSubject
      );
    };
    const releasedEntries: QuarantineEntries = {
      nodes: entries.nodes.filter((entry) => !isRootEntry(entry)),
      edges: entries.edges.filter((entry) => !isRootEntry(entry)),
    };
    const released = releaseQuarantine(current, events, releasedEntries);
    if (released.diagnostics) {
      return reject(request, released.diagnostics, conflict);
    }

    const changedDecisionById = new Map(
      changedDecisions.map((node) => [node.id, node]),
    );
    for (const event of events) {
      if (event.kind !== "node") continue;
      const previous = current.nodes.find((node) => node.id === event.node.id);
      if (lockedDecision(previous) || lockedDecision(event.node)) {
        changedDecisionById.set(event.node.id, previous ?? event.node);
      }
    }
    const authority = authorityDiagnostics(
      [...changedDecisionById.values()],
      request.decisionOwnerAuthorization,
    );
    if (authority.length > 0) {
      return reject(request, authority, conflict);
    }

    const resolved = resolvedConflict(conflict, request, mode);
    addEvent(events, { kind: "node", node: resolved });
    const prospective = applyEvents(current, events);
    const validation = validateGraph(prospective);
    const activeValidation = validateGraph(activeGraph(prospective));
    if (!validation.valid || !activeValidation.valid) {
      const diagnostics = [
        ...validation.diagnostics,
        ...activeValidation.diagnostics,
      ].map(({ code, message }) => ({
        code: "INVALID_PROSPECTIVE_GRAPH",
        message,
      }));
      return reject(request, diagnostics, conflict);
    }

    const evidence = evidenceDiagnostics(current, prospective);
    if (evidence.length > 0) {
      return reject(request, evidence, conflict);
    }

    if (events.length > 0) batch.appendEvents(events);
    return {
      outcome: "RESOLVED",
      conflict_id: conflict.id,
      expected_conflict_digest: request.expectedConflictDigest,
      actual_conflict_digest: String(actualDigest),
      resolution_mode: mode,
      applied_subjects: [...new Set(appliedSubjects)].sort((left, right) =>
        left.localeCompare(right),
      ),
      released_subjects: [...new Set(released.released)].sort((left, right) =>
        left.localeCompare(right),
      ),
      diagnostics: [],
    };
  });
}
