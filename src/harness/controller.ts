import { resolve } from "node:path";
import {
  ingestMattFile,
  normalizeMattArtifact,
  type MattSkill,
} from "../adapters/matt/ingest.js";
import {
  canReopenDecision,
  projectGsd,
  type GsdProjection,
  type ProjectGsdOptions,
} from "../adapters/gsd/projector.js";
import type { Node } from "../core/schemas/nodes.js";
import { NodeSchema } from "../core/schemas/nodes.js";
import { EpistemicGraph } from "../graph/epistemic-graph.js";
import type { MaterializedGraph } from "../graph/domain.js";
import { detectGsd, type GsdDetectionOptions } from "../adapters/gsd/detector.js";

export type AriadneHarnessControllerOptions = {
  rootDirectory?: string;
  storageRoot?: string;
  gsd?: GsdDetectionOptions;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const BLOCKING_DECISION_STATUSES = new Set([
  "RE_OPENED",
  "INVALIDATED",
  "STALE",
  "REQUIRES_REVALUATION",
]);

const isBlockingDecision = (node: Node): boolean =>
  node.type === "DEC" &&
  typeof node.status === "string" &&
  BLOCKING_DECISION_STATUSES.has(node.status.toUpperCase().replaceAll("-", "_"));

export class AriadneHarnessController {
  readonly rootDirectory: string;
  readonly graph: EpistemicGraph;
  readonly storageRoot: string;

  constructor(options: AriadneHarnessControllerOptions = {}) {
    this.rootDirectory = resolve(options.rootDirectory ?? process.cwd());
    const gsd = detectGsd(this.rootDirectory, options.gsd);
    this.storageRoot = options.storageRoot ?? gsd.storageRoot;
    this.graph = EpistemicGraph.open(this.storageRoot);
  }

  async projectGsd(options: Omit<ProjectGsdOptions, "rootDirectory"> = {}): Promise<GsdProjection> {
    const projection = await projectGsd(this.rootDirectory, options);
    const graph = await this.graph.materialize();
    const current = new Map(graph.nodes.map((node) => [node.id, node]));
    const preserveBlockingDecisions = !canReopenDecision(options);
    const projectedNodes = projection.nodes.map((node) => {
      const existing = current.get(node.id);
      return preserveBlockingDecisions && existing && isBlockingDecision(existing)
        ? existing
        : node;
    });
    const projectedById = new Map(projectedNodes.map((node) => [node.id, node]));
    const persistedProjection: GsdProjection = {
      ...projection,
      nodes: projectedNodes,
      decisions: projection.decisions.map((decision) => projectedById.get(decision.id) ?? decision),
    };
    const events = persistedProjection.nodes
      .filter((node) => !sameJson(current.get(node.id), node))
      .map((node) => ({ kind: "node" as const, node }));
    if (events.length > 0) {
      await this.graph.batch((batch) => batch.appendEvents(events));
    }

    const previous = await this.graph.getState();
    const previousFrontier = isRecord(previous) && Array.isArray(previous.frontier)
      ? previous.frontier
      : [];
    const frontier = [
      ...new Set([
        ...previousFrontier.filter((id): id is string => typeof id === "string"),
        ...persistedProjection.nodes.map((node) => node.id),
      ]),
    ];
    const nextState = {
      ...(isRecord(previous) ? previous : {}),
      schema_version:
        isRecord(previous) && typeof previous.schema_version === "number"
          ? previous.schema_version
          : 1,
      mode: "gsd",
      frontier,
      open_unknowns:
        isRecord(previous) && Array.isArray(previous.open_unknowns)
          ? previous.open_unknowns
          : [],
      gsd_projection: {
        state_path: projection.documents.statePath,
        active_phase: persistedProjection.activePhase,
      },
    };
    if (!sameJson(previous, nextState)) {
      await this.graph.batch((batch) =>
        batch.writeStateProjection(`${JSON.stringify(nextState, null, 2)}\n`),
      );
    }
    return persistedProjection;
  }

  async ingestMattArtifact(skill: MattSkill | string, artifact: unknown): Promise<Node> {
    const node = normalizeMattArtifact(skill, artifact);
    await this.graph.batch((batch) => batch.appendEvents([{ kind: "node", node }]));
    return node;
  }

  async ingestMattFile(skill: MattSkill | string, path: string): Promise<Node> {
    const node = await ingestMattFile(skill, path);
    await this.graph.batch((batch) => batch.appendEvents([{ kind: "node", node }]));
    return node;
  }

  async persistNode(node: unknown): Promise<Node> {
    const parsed = NodeSchema.parse(node);
    await this.graph.batch((batch) => batch.appendEvents([{ kind: "node", node: parsed }]));
    return node as Node;
  }

  async readGraph(): Promise<MaterializedGraph> {
    return this.graph.materialize();
  }
}

export const createHarnessController = (
  options: AriadneHarnessControllerOptions = {},
): AriadneHarnessController => new AriadneHarnessController(options);
