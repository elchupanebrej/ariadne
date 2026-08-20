import { resolve } from "node:path";
import { ingestMattFile } from "../../adapters/matt/ingest.js";
import type { Node } from "../../core/schemas/nodes.js";

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
