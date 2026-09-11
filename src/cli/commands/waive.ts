import { hasHelp, parseOptions, syntaxError } from "../contract.js";
import { resolveCliWorkspace, maybeEmitCompactionAdvisory } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import { assertNotLegacyWorkspace } from "../../graph/legacy.js";

const WAIVE_USAGE = "Usage: ariadne waive <node-id> --by <decision-id>\n";

const parseArgs = (args: readonly string[]): { nodeId: string; decisionId: string } => {
  const parsed = parseOptions(
    args,
    [{ name: "by", takesValue: true }],
    WAIVE_USAGE.trim(),
  );
  if (parsed.positionals.length !== 1 || parsed.flags.size > 0) {
    throw syntaxError(WAIVE_USAGE.trim());
  }
  const decisionId = parsed.values.get("by");
  if (decisionId === undefined || decisionId.trim() === "") {
    throw syntaxError(`Option --by requires a value. ${WAIVE_USAGE.trim()}`);
  }
  return { nodeId: parsed.positionals[0]!, decisionId: decisionId.trim() };
};

export async function runWaive(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args, ["--by"])) {
    io.stdout.write(WAIVE_USAGE);
    return 0;
  }
  const { nodeId, decisionId } = parseArgs(args);
  const { environment, graph } = await resolveCliWorkspace(io);
  await assertNotLegacyWorkspace(environment.storageRoot);

  const result = await graph.waive(nodeId, decisionId);

  io.stdout.write(`${JSON.stringify(result)}\n`);
  await maybeEmitCompactionAdvisory(environment.storageRoot, io);
  return 0;
}
