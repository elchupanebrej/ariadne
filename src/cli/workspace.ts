import type { Writable } from "node:stream";
import { statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { detectGsd, type GsdEnvironment } from "../adapters/gsd/detector.js";
import { GraphStorage } from "../graph/storage.js";

export type CliIO = {
  cwd: string;
  stdout: Writable;
  stderr: Writable;
};

export type CliWorkspace = {
  environment: GsdEnvironment;
  storage: GraphStorage;
};

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** Find the nearest initialized Ariadne/GSD root for commands run in a subdirectory. */
export function findCliWorkspaceRoot(cwd = process.cwd()): string {
  let current = resolve(cwd);
  while (true) {
    if (isDirectory(join(current, ".planning"))) return current;
    if (isDirectory(join(current, ".ariadne"))) return current;
    const parent = dirname(current);
    if (parent === current) return resolve(cwd);
    current = parent;
  }
}

export async function resolveCliWorkspace(io: CliIO): Promise<CliWorkspace> {
  const root = findCliWorkspaceRoot(io.cwd);
  const environment = detectGsd(root);
  return { environment, storage: new GraphStorage(environment.storageRoot) };
}
