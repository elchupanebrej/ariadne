import type { Writable } from "node:stream";
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

export async function resolveCliWorkspace(io: CliIO): Promise<CliWorkspace> {
  const environment = detectGsd(io.cwd);
  return { environment, storage: new GraphStorage(environment.storageRoot) };
}
