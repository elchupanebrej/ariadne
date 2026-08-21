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
import { GraphStorage, type MaterializedGraph } from "../graph/storage.js";
import {
  CapabilityProviderManager,
  type Capability,
  type EcosystemMode,
  type ProviderManagerOptions,
  type ProviderSelection,
} from "../capabilities/provider-manager.js";

export type AriadneHarnessControllerOptions = ProviderManagerOptions;

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
  readonly capabilities: CapabilityProviderManager;
  readonly storage: GraphStorage;
  readonly storageRoot: string;

  constructor(options: AriadneHarnessControllerOptions = {}) {
    this.rootDirectory = resolve(options.rootDirectory ?? process.cwd());
    this.capabilities = new CapabilityProviderManager(this.rootDirectory, options);
    this.storageRoot = this.capabilities.gsd.storageRoot;
    this.storage = new GraphStorage(this.storageRoot);
  }

  get mode(): EcosystemMode {
    return this.capabilities.mode;
  }

  get provider(): CapabilityProviderManager {
    return this.capabilities;
  }

  providerFor(capability: Capability = "reasoning"): ProviderSelection {
    return this.capabilities.providerFor(capability);
  }

  async projectGsd(options: Omit<ProjectGsdOptions, "rootDirectory"> = {}): Promise<GsdProjection> {
    const projection = await projectGsd(this.rootDirectory, options);
    const graph = await this.storage.readGraph();
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
    if (events.length > 0) await this.storage.appendEvents(events);

    const previous = await this.storage.readState<Record<string, unknown>>();
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
    if (!sameJson(previous, nextState)) await this.storage.writeState(nextState);
    return persistedProjection;
  }

  async ingestMattArtifact(skill: MattSkill | string, artifact: unknown): Promise<Node> {
    const node = normalizeMattArtifact(skill, artifact);
    await this.storage.appendNode(node);
    return node;
  }

  async ingestMattFile(skill: MattSkill | string, path: string): Promise<Node> {
    const node = await ingestMattFile(skill, path);
    await this.storage.appendNode(node);
    return node;
  }

  async persistNode(node: unknown): Promise<Node> {
    await this.storage.appendNode(node);
    return node as Node;
  }

  async readGraph(): Promise<MaterializedGraph> {
    return this.storage.readGraph();
  }
}

export const createHarnessController = (
  options: AriadneHarnessControllerOptions = {},
): AriadneHarnessController => new AriadneHarnessController(options);
