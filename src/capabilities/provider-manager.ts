import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { MATT_SKILLS } from "../adapters/matt/ingest.js";
import { detectGsd, type GsdDetectionOptions, type GsdEnvironment } from "../adapters/gsd/detector.js";

export type EcosystemMode = "A" | "B" | "C" | "D";
export type ProviderKind = "matt" | "native";
export type Capability = "matt" | "engineering" | "reasoning" | "gsd";

export type ProviderSelection = {
  kind: ProviderKind;
  available: true;
  capability: Capability;
  reason: string;
};

export type ProviderManagerOptions = {
  rootDirectory?: string;
  mattAvailable?: boolean;
  mattSkillPath?: string;
  mattSkillPaths?: readonly string[];
  gsd?: GsdDetectionOptions;
};

export type CapabilitySnapshot = {
  mode: EcosystemMode;
  gsd: GsdEnvironment;
  mattAvailable: boolean;
};

const standardSkillRoots = [
  ".agents/skills",
  ".codex/skills",
  ".claude/skills",
  ".cursor/skills",
] as const;

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const hasSkillMarker = (path: string): boolean =>
  existsSync(join(path, "SKILL.md")) || isDirectory(path);

export function detectMattAvailability(
  rootDirectory = process.cwd(),
  options: Pick<ProviderManagerOptions, "mattAvailable" | "mattSkillPath" | "mattSkillPaths"> = {},
): boolean {
  if (options.mattAvailable !== undefined) return options.mattAvailable;
  const root = resolve(rootDirectory);
  const explicitPaths = [
    ...(options.mattSkillPath ? [options.mattSkillPath] : []),
    ...(options.mattSkillPaths ?? []),
  ];
  if (explicitPaths.some((path) => hasSkillMarker(resolve(root, path)))) return true;

  return standardSkillRoots.some((skillRoot) =>
    hasSkillMarker(join(root, skillRoot, "mattpocock-skills")) ||
    MATT_SKILLS.some((skill) => hasSkillMarker(join(root, skillRoot, skill))),
  );
}

export class CapabilityProviderManager {
  readonly rootDirectory: string;
  readonly gsd: GsdEnvironment;
  readonly mattAvailable: boolean;
  readonly mode: EcosystemMode;

  constructor(
    rootDirectoryOrOptions: string | ProviderManagerOptions = process.cwd(),
    providedOptions: ProviderManagerOptions = {},
  ) {
    const options =
      typeof rootDirectoryOrOptions === "string" ? providedOptions : rootDirectoryOrOptions;
    const rootDirectory =
      typeof rootDirectoryOrOptions === "string"
        ? rootDirectoryOrOptions
        : options.rootDirectory ?? process.cwd();
    this.rootDirectory = resolve(rootDirectory);
    this.gsd = detectGsd(this.rootDirectory, options.gsd);
    this.mattAvailable = detectMattAvailability(this.rootDirectory, options);
    this.mode = this.gsd.active
      ? this.mattAvailable
        ? "A"
        : "B"
      : this.mattAvailable
        ? "C"
        : "D";
  }

  snapshot(): CapabilitySnapshot {
    return { mode: this.mode, gsd: this.gsd, mattAvailable: this.mattAvailable };
  }

  detect(): CapabilitySnapshot {
    return this.snapshot();
  }

  providerFor(capability: Capability = "reasoning"): ProviderSelection {
    if (capability === "matt" || capability === "engineering") {
      if (this.mattAvailable) {
        return {
          kind: "matt",
          available: true,
          capability,
          reason: "Matt skill path detected or explicitly enabled",
        };
      }
      return {
        kind: "native",
        available: true,
        capability,
        reason: "Matt skills are absent; using the native provider",
      };
    }

    if (capability === "gsd" && !this.gsd.active) {
      return {
        kind: "native",
        available: true,
        capability,
        reason: "GSD is absent; using the standalone native provider",
      };
    }
    return {
      kind: "native",
      available: true,
      capability,
      reason: this.gsd.active
        ? "GSD is the operational provider"
        : "Using the standalone native provider",
    };
  }

  selectProvider(capability: Capability = "reasoning"): ProviderSelection {
    return this.providerFor(capability);
  }
}

export const detectCapabilities = (
  rootDirectory = process.cwd(),
  options: ProviderManagerOptions = {},
): CapabilitySnapshot => new CapabilityProviderManager(rootDirectory, options).snapshot();
