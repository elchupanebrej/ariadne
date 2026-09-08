import { hasHelp, resolveCliWorkspace, maybeEmitCompactionAdvisory } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import { assertNotLegacyWorkspace } from "../../graph/legacy.js";

const INVALIDATE_USAGE = "Usage: ariadne invalidate <node_id> --by <evidence_id>\n";

const parseArgs = (args: readonly string[]): { nodeId: string; evidenceId: string } => {
  if (args.length !== 3 || args[1] !== "--by" || !args[0] || !args[2]) {
    throw new Error(INVALIDATE_USAGE.trim());
  }
  return { nodeId: args[0], evidenceId: args[2] };
};

export async function runInvalidation(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args, ["--by"])) {
    io.stdout.write(INVALIDATE_USAGE);
    return 0;
  }
  const { nodeId, evidenceId } = parseArgs(args);
  const { environment, graph } = await resolveCliWorkspace(io);
  await assertNotLegacyWorkspace(environment.storageRoot);

  const result = await graph.invalidate(nodeId, evidenceId, {
    rootPath: environment.rootPath,
    notify: (banner) => io.stdout.write(`${banner}\n`),
  });

  io.stdout.write(`${JSON.stringify(result)}\n`);
  await maybeEmitCompactionAdvisory(environment.storageRoot, io);
  return 0;
}
