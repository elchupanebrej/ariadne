import { basename, dirname, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { ingestMattFile } from "../../adapters/matt/ingest.js";
import { detectGsd } from "../../adapters/gsd/detector.js";
import { AriadneHarnessController } from "../../harness/controller.js";
import type { Node } from "../../core/schemas/nodes.js";
import { findCliWorkspaceRoot, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

/** Runs the arguments that follow `ariadne ingest`. */
export async function runMattIngest(
  args: readonly string[],
  cwd = process.cwd(),
): Promise<Node> {
  if (
    args.length !== 3 ||
    args[0] !== "matt" ||
    args[1].trim() === "" ||
    args[2].trim() === ""
  ) {
    throw new Error("Usage: ariadne ingest matt <skill> <file>");
  }

  return ingestMattFile(args[1], resolve(cwd, args[2]));
}

const gsdRootFor = async (path: string, cwd: string): Promise<string> => {
  let candidate = resolve(cwd, path);
  try {
    if ((await stat(candidate)).isFile()) candidate = dirname(candidate);
  } catch {
    // Let the normal GSD activation check below provide the useful error.
  }

  if (basename(candidate) === ".planning") candidate = dirname(candidate);
  if (detectGsd(candidate).active) return candidate;

  const workspaceRoot = findCliWorkspaceRoot(candidate);
  if (detectGsd(workspaceRoot).active) return workspaceRoot;
  throw new Error(`GSD workspace not found from ${resolve(cwd, path)}`);
};

export async function runGsdIngest(args: readonly string[], cwd = process.cwd()) {
  if (args.length !== 2 || args[0] !== "gsd" || args[1].trim() === "") {
    throw new Error("Usage: ariadne ingest gsd <path>");
  }
  const root = await gsdRootFor(args[1], cwd);
  return new AriadneHarnessController({ rootDirectory: root }).projectGsd();
}

export async function runIngest(args: readonly string[], io: CliIO): Promise<number> {
  if (args[0] === "gsd") {
    const projection = await runGsdIngest(args, io.cwd);
    io.stdout.write(`${JSON.stringify(projection)}\n`);
    return 0;
  }
  const node = await runMattIngest(args, io.cwd);
  const { storage } = await resolveCliWorkspace(io);
  await storage.appendNode(node);
  io.stdout.write(`${JSON.stringify(node)}\n`);
  return 0;
}
