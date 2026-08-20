import { resolve } from "node:path";
import {
  ingestMattFile,
  normalizeMattArtifact,
  type MattSkill,
} from "../adapters/matt/ingest.js";
import {
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
    return projectGsd(this.rootDirectory, options);
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
