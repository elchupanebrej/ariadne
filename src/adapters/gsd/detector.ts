import { existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

export const GSD_SHADOW_FILES = [
  "PROJECT.md",
  "REQUIREMENTS.md",
  "ROADMAP.md",
  "STATE.md",
] as const;

export type GsdDetectionOptions = {
  /** Force GSD mode when true, or standalone mode when false. */
  override?: boolean;
  force?: boolean;
};

export type GsdEnvironment = {
  active: boolean;
  rootPath: string;
  planningPath: string;
  overlayPath: string;
  storageRoot: string;
};

export class GsdShadowStateError extends Error {
  readonly shadowFiles: string[];

  constructor(shadowFiles: string[]) {
    super(`Ariadne shadow state is not allowed in GSD mode: ${shadowFiles.join(", ")}`);
    this.name = "GsdShadowStateError";
    this.shadowFiles = shadowFiles;
  }
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

export function detectGsd(
  rootDirectory = process.cwd(),
  options: GsdDetectionOptions = {},
): GsdEnvironment {
  const rootPath = resolve(rootDirectory);
  const planningPath = join(rootPath, ".planning");
  const overlayPath = join(planningPath, "ariadne");
  const detected = isDirectory(planningPath);
  const override = options.override ?? options.force;
  const active = override ?? detected;

  return {
    active,
    rootPath,
    planningPath,
    overlayPath,
    storageRoot: active ? overlayPath : join(rootPath, ".ariadne"),
  };
}

const environmentFor = (
  rootOrEnvironment: string | GsdEnvironment,
  options: GsdDetectionOptions,
): GsdEnvironment =>
  typeof rootOrEnvironment === "string"
    ? detectGsd(rootOrEnvironment, options)
    : rootOrEnvironment;

export function findZeroShadowFiles(
  rootOrEnvironment: string | GsdEnvironment = process.cwd(),
  options: GsdDetectionOptions = {},
): string[] {
  const environment = environmentFor(rootOrEnvironment, options);
  if (!environment.active) return [];

  const candidates = [
    ...GSD_SHADOW_FILES.map((name) => join(environment.rootPath, name)),
    ...GSD_SHADOW_FILES.map((name) => join(environment.rootPath, ".ariadne", name)),
    ...GSD_SHADOW_FILES.map((name) => join(environment.overlayPath, name)),
  ];
  return candidates.filter((path) => existsSync(path) && isFile(path));
}

export function assertNoShadowState(
  rootOrEnvironment: string | GsdEnvironment = process.cwd(),
  options: GsdDetectionOptions = {},
): void {
  const shadowFiles = findZeroShadowFiles(rootOrEnvironment, options);
  if (shadowFiles.length > 0) throw new GsdShadowStateError(shadowFiles);
}

export function resolveAriadneStorageRoot(
  rootDirectory = process.cwd(),
  options: GsdDetectionOptions = {},
): string {
  return detectGsd(rootDirectory, options).storageRoot;
}

export const detectGsdWorkspace = detectGsd;
export const checkZeroShadowState = assertNoShadowState;
export const getGsdOverlayPath = (rootDirectory = process.cwd()): string =>
  detectGsd(rootDirectory, { override: true }).overlayPath;
export const getAriadneStorageRoot = resolveAriadneStorageRoot;
