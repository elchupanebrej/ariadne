import { dirname } from "node:path";
import {
  canonicalEdgeRelation,
  EdgeSchema,
  type EpistemicEdge,
  unknownEdgeRelation,
} from "../core/schemas/edges.js";
import {
  NODE_TYPES,
  NodeSchemas,
  type Node,
  type NodeType,
} from "../core/schemas/nodes.js";
import type { ProvenanceType } from "../core/types/nodes.js";
import { validateGraph } from "./integrity.js";
import { assertWithinCapacity } from "./capacity.js";
import {
  propagateInvalidation,
  type InvalidationTraceEntry,
} from "./invalidation.js";
import { emitOperationalNotice } from "../adapters/gsd/operational-notice.js";
import {
  EpistemicGateEngine,
  type GateReceipt,
  type GateVerificationOptions,
} from "../gates/gate-engine.js";
import {
  buildReport,
  type ReportOptions,
  type ReportOutput,
} from "./report-engine.js";
import {
  FileSystemStorageDriver,
  InMemoryStorageDriver,
  type StorageDriver,
} from "./storage-driver.js";

export type { InvalidationTraceEntry } from "./invalidation.js";
export type {
  ReportOptions,
  ReportOutput,
  ReportSummary,
} from "./report-engine.js";

import {
  renderCard,
  renderIndex,
  GraphEventSchema,
  isFrontierNode,
  type AriadneState,
  type GraphEvent,
  type MaterializedGraph,
} from "./storage.js";

const edgeKey = (edge: Pick<EpistemicEdge, "source" | "type" | "target">): string =>
  `${edge.source}\u0000${edge.type}\u0000${edge.target}`;

const applyEvents = (
  graph: MaterializedGraph,
  events: readonly GraphEvent[],
): MaterializedGraph => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const edges = new Map(graph.edges.map((edge) => [edgeKey(edge), edge]));

  for (const event of events) {
    if (event.kind === "node") nodes.set(event.node.id, event.node);
    else if (event.tombstone) edges.delete(edgeKey(event.edge));
    else edges.set(edgeKey(event.edge), event.edge);
  }

  return {
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...edges.values()].sort((left, right) =>
      edgeKey(left).localeCompare(edgeKey(right)),
    ),
  };
};

const updateStateForGraph = (
  state: Record<string, unknown>,
  graph: MaterializedGraph,
): Record<string, unknown> => {
  const frontierNodes = graph.nodes.filter(isFrontierNode);
  const frontier = frontierNodes.map((node) => node.id);
  const openUnknowns = frontierNodes
    .filter((node) => node.type === "UNK")
    .map((node) => node.id);
  const next: Record<string, unknown> = { ...state, frontier, open_unknowns: openUnknowns };
  if ("active_frontier" in state) next.active_frontier = frontier;
  if ("openUnknowns" in state) next.openUnknowns = openUnknowns;
  if ("unknowns" in state) next.unknowns = openUnknowns;
  return next;
};

export interface NodeFilter {
  type?: NodeType;
  provenance?: ProvenanceType;
  status?: string;
  frontierOnly?: boolean;
}

export interface EdgeFilter {
  from?: string;
  to?: string;
  relation?: string;
}

export class EpistemicGraph {
  public readonly driver: StorageDriver;

  constructor(driver: StorageDriver) {
    this.driver = driver;
  }

  static open(root = ".ariadne"): EpistemicGraph {
    return new EpistemicGraph(new FileSystemStorageDriver(root));
  }

  static inMemory(initialGraph?: MaterializedGraph): EpistemicGraph {
    const driver = new InMemoryStorageDriver();
    if (initialGraph) {
      const events: GraphEvent[] = [
        ...initialGraph.nodes.map((node) => ({ kind: "node" as const, node })),
        ...initialGraph.edges.map((edge) => ({ kind: "edge" as const, edge })),
      ];
      driver.events = events;
      driver.indexContent = renderIndex(initialGraph);
      for (const node of initialGraph.nodes) {
        driver.cards.set(node.id, renderCard(node));
      }
      driver.state = updateStateForGraph({}, initialGraph);
    }
    return new EpistemicGraph(driver);
  }

  async init(): Promise<void> {
    await this.driver.init();
  }

  async materialize(): Promise<MaterializedGraph> {
    const events = (await this.driver.readEvents()).map((event) => GraphEventSchema.parse(event));
    return applyEvents({ nodes: [], edges: [] }, events);
  }

  async getState(): Promise<AriadneState> {
    const raw = await this.driver.readState();
    return (raw ?? {}) as AriadneState;
  }

  async getFrontier(): Promise<string[]> {
    const graph = await this.materialize();
    return graph.nodes.filter(isFrontierNode).map((n) => n.id);
  }

  async getOpenUnknowns(): Promise<string[]> {
    const graph = await this.materialize();
    return graph.nodes.filter((n) => isFrontierNode(n) && n.type === "UNK").map((n) => n.id);
  }

  async getNode(id: string): Promise<Node | undefined> {
    const graph = await this.materialize();
    return graph.nodes.find((node) => node.id === id);
  }

  async listNodes(filter?: NodeFilter): Promise<Node[]> {
    const graph = await this.materialize();
    return graph.nodes.filter((node) => {
      if (node.status === "REMOVED" || (node as any).tombstone) return false;
      if (filter?.type && node.type !== filter.type) return false;
      if (filter?.provenance && node.provenance_type !== filter.provenance) return false;
      if (filter?.status && (node.status ?? "ACTIVE") !== filter.status) return false;
      if (filter?.frontierOnly && !isFrontierNode(node)) return false;
      return true;
    });
  }

  async listEdges(filter?: EdgeFilter): Promise<EpistemicEdge[]> {
    const graph = await this.materialize();
    return graph.edges.filter((edge) => {
      if (filter?.from && edge.source !== filter.from) return false;
      if (filter?.to && edge.target !== filter.to) return false;
      if (filter?.relation && edge.type !== filter.relation) return false;
      return true;
    });
  }

  async renderIndex(): Promise<string> {
    const graph = await this.materialize();
    return renderIndex(graph);
  }

  /**
   * High-level atomic node insertion with schema & duplicate validation.
   */
  async addNode(
    type: NodeType,
    id: string,
    title: string,
    payload: Record<string, unknown> = {},
  ): Promise<Node> {
    const parser = NodeSchemas[type];
    if (!parser) {
      throw new Error(`Unsupported node type: ${type}`);
    }

    const statement = (payload.statement as string | undefined) ?? title;
    const provenance_type = (payload.provenance_type as ProvenanceType | undefined) ?? "PROPOSED";
    const parsed = parser.parse({ ...payload, type, id, title, statement, provenance_type }) as Node;

    return await this.driver.withLock(async () => {
      const current = await this.materialize();
      if (current.nodes.some((n) => n.id === id)) {
        throw new Error(`Node ${id} already exists`);
      }

      const next = applyEvents(current, [{ kind: "node", node: parsed }]);
      const integrity = validateGraph(next);
      if (!integrity.valid) {
        throw new Error(
          integrity.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; "),
        );
      }

      const existingEvents = await this.driver.readEvents();
      assertWithinCapacity({
        nodeCount: next.nodes.length,
        edgeCount: next.edges.length,
        eventCount: existingEvents.length + 1,
      });

      await this.driver.appendEvents([{ kind: "node", node: parsed }]);
      await this.driver.writeCards([{ id: parsed.id, content: renderCard(parsed) }]);
      await this.driver.writeIndex(renderIndex(next));

      const prevState = (await this.driver.readState()) ?? {};
      await this.driver.writeState(updateStateForGraph(prevState, next));

      return parsed;
    });
  }

  /**
   * High-level atomic node update with immutability and schema verification.
   */
  async updateNode(
    id: string,
    patch: { title?: string; payload?: Record<string, unknown>; status?: string },
  ): Promise<Node> {
    return await this.driver.withLock(async () => {
      const current = await this.materialize();
      const existing = current.nodes.find((n) => n.id === id);
      if (!existing) {
        throw new Error(`Node ${id} not found`);
      }

      if (patch.payload?.id !== undefined && patch.payload.id !== id) {
        throw new Error(`Cannot change node id: ${String(patch.payload.id)}`);
      }
      if (patch.payload?.type !== undefined && patch.payload.type !== existing.type) {
        throw new Error(`Cannot change node type: ${String(patch.payload.type)}`);
      }

      const type = existing.type;
      const parser = NodeSchemas[type];
      const mergedPayload = {
        ...existing,
        ...(patch.payload ?? {}),
        type, // Immutable type
        id,   // Immutable id
      };
      if (patch.title !== undefined) mergedPayload.title = patch.title;
      if (patch.status !== undefined) mergedPayload.status = patch.status;

      const parsed = parser.parse(mergedPayload) as Node;
      const next = applyEvents(current, [{ kind: "node", node: parsed }]);
      const integrity = validateGraph(next);
      if (!integrity.valid) {
        throw new Error(
          integrity.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; "),
        );
      }

      const existingEvents = await this.driver.readEvents();
      assertWithinCapacity({
        nodeCount: next.nodes.length,
        edgeCount: next.edges.length,
        eventCount: existingEvents.length + 1,
      });

      await this.driver.appendEvents([{ kind: "node", node: parsed }]);
      await this.driver.writeCards([{ id: parsed.id, content: renderCard(parsed) }]);
      await this.driver.writeIndex(renderIndex(next));

      const prevState = (await this.driver.readState()) ?? {};
      await this.driver.writeState(updateStateForGraph(prevState, next));

      return parsed;
    });
  }


  /**
   * High-level atomic node removal (marks as tombstoned/REMOVED).
   */
  async removeNode(id: string): Promise<Node> {
    return await this.updateNode(id, { status: "REMOVED" });
  }

  /**
   * High-level atomic edge insertion with endpoint & DAG cycle validation.
   */
  async addEdge(source: string, relation: string, target: string): Promise<EpistemicEdge> {
    const canonicalRelation = canonicalEdgeRelation(relation);
    if (!canonicalRelation) {
      throw new Error(unknownEdgeRelation(relation));
    }
    const edge = EdgeSchema.parse({ source, type: canonicalRelation, target });

    return await this.driver.withLock(async () => {
      const current = await this.materialize();
      if (!current.nodes.some((n) => n.id === source)) {
        throw new Error(`Edge source ${source} does not exist`);
      }
      if (!current.nodes.some((n) => n.id === target)) {
        throw new Error(`Edge target ${target} does not exist`);
      }
      if (current.edges.some((e) => edgeKey(e) === edgeKey(edge))) {
        throw new Error(`Edge already exists: ${edgeKey(edge)}`);
      }

      const next = applyEvents(current, [{ kind: "edge", edge }]);
      const integrity = validateGraph(next);
      if (!integrity.valid) {
        throw new Error(
          integrity.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; "),
        );
      }

      const existingEvents = await this.driver.readEvents();
      assertWithinCapacity({
        nodeCount: next.nodes.length,
        edgeCount: next.edges.length,
        eventCount: existingEvents.length + 1,
      });

      await this.driver.appendEvents([{ kind: "edge", edge }]);
      await this.driver.writeIndex(renderIndex(next));

      return edge;
    });
  }

  /**
   * High-level atomic edge removal (appends tombstone event).
   */
  async removeEdge(source: string, relation: string, target: string): Promise<EpistemicEdge> {
    const canonicalRelation = canonicalEdgeRelation(relation);
    if (!canonicalRelation) {
      throw new Error(unknownEdgeRelation(relation));
    }
    const edge = EdgeSchema.parse({ source, type: canonicalRelation, target });

    return await this.driver.withLock(async () => {
      const current = await this.materialize();
      const existing = current.edges.find((e) => edgeKey(e) === edgeKey(edge));
      if (!existing) {
        throw new Error(`Edge not found: ${edgeKey(edge)}`);
      }

      const next = applyEvents(current, [{ kind: "edge", edge, tombstone: true }]);
      const integrity = validateGraph(next);
      if (!integrity.valid) {
        throw new Error(
          integrity.diagnostics.map((d) => `${d.code}: ${d.message}`).join("; "),
        );
      }

      const existingEvents = await this.driver.readEvents();
      assertWithinCapacity({
        nodeCount: next.nodes.length,
        edgeCount: next.edges.length,
        eventCount: existingEvents.length + 1,
      });

      await this.driver.appendEvents([{ kind: "edge", edge, tombstone: true }]);
      await this.driver.writeIndex(renderIndex(next));

      return edge;
    });
  }

  /**
   * Atomic transitive invalidation cascade across reverse dependency topology.
   */
  async invalidate(
    nodeId: string,
    evidenceId: string,
    options?: { rootPath?: string; notify?: (banner: string) => unknown | Promise<unknown> },
  ): Promise<{
    falsified_node_id: string;
    evidence_id: string;
    affected_node_ids: string[];
    trace: InvalidationTraceEntry[];
  }> {
    const changed = (before: Node, after: Node): boolean =>
      JSON.stringify(before) !== JSON.stringify(after);

    const result = await this.driver.withLock(async () => {
      const current = await this.materialize();
      const target = current.nodes.find(({ id }) => id === nodeId);
      if (!target) throw new Error(`Node not found: ${nodeId}`);
      if (target.type !== "ASM" && target.type !== "HYP") {
        throw new Error(`Invalidation target ${nodeId} must be ASM or HYP`);
      }
      const evidence = current.nodes.find(({ id }) => id === evidenceId);
      if (!evidence || evidence.type !== "EVD") {
        throw new Error(`Evidence ${evidenceId} must be an EVD node`);
      }

      const invalidation = propagateInvalidation(current, nodeId, evidenceId);
      const beforeById = new Map(current.nodes.map((node) => [node.id, node]));
      const updatedNodes = invalidation.graph.nodes.filter((node) => {
        const before = beforeById.get(node.id);
        return before !== undefined && changed(before, node);
      });
      const events: GraphEvent[] = updatedNodes.map((node) => ({ kind: "node" as const, node }));
      const affectedNodeIds = invalidation.trace
        .filter(({ status }) => status !== undefined)
        .map(({ node_id }) => node_id)
        .sort((left, right) => left.localeCompare(right));

      const existingEvents = await this.driver.readEvents();
      assertWithinCapacity({
        nodeCount: invalidation.graph.nodes.length,
        edgeCount: invalidation.graph.edges.length,
        eventCount: existingEvents.length + events.length,
      });

      await this.driver.appendEvents(events);
      await this.driver.writeCards(
        updatedNodes.map((node) => ({ id: node.id, content: renderCard(node) })),
      );
      await this.driver.writeIndex(renderIndex(invalidation.graph));

      const priorState = (await this.driver.readState()) ?? {};
      const nextState = updateStateForGraph(priorState, invalidation.graph);
      nextState.last_invalidation = {
        node_id: nodeId,
        evidence_id: evidenceId,
        affected_node_ids: affectedNodeIds,
      };
      await this.driver.writeState(nextState);

      return {
        falsified_node_id: nodeId,
        evidence_id: evidenceId,
        affected_node_ids: affectedNodeIds,
        trace: invalidation.trace,
      };
    });

    const rootPath =
      options?.rootPath ??
      (this.driver instanceof FileSystemStorageDriver
        ? dirname(this.driver.root)
        : process.cwd());

    try {
      await emitOperationalNotice(
        rootPath,
        {
          falsifiedId: nodeId,
          evidenceId,
          affectedIds: result.affected_node_ids,
        },
        options?.notify,
      );
    } catch {
      // In-memory or non-filesystem environments gracefully skip notice
    }

    return result;
  }

  /**
   * Run verification gates against the materialized graph.
   */
  async gate(options?: GateVerificationOptions): Promise<GateReceipt> {
    const graph = await this.materialize();
    return EpistemicGateEngine.verify(graph, options);
  }

  /**
   * Build a decision tree or epistemic forest report.
   */
  async report(options: ReportOptions = {}): Promise<ReportOutput> {
    const events = (await this.driver.readEvents()).map((event) => GraphEventSchema.parse(event));
    const graphPath =
      this.driver instanceof FileSystemStorageDriver
        ? this.driver.graphPath
        : undefined;
    return buildReport(events, { graphPath, ...options });
  }
}
