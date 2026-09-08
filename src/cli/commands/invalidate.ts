import { hasHelp, parseOptions, syntaxError, writeDomainDiagnostic } from "../contract.js";
import { resolveCliWorkspace, maybeEmitCompactionAdvisory } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import { assertNotLegacyWorkspace } from "../../graph/legacy.js";

const INVALIDATE_USAGE = "Usage: ariadne invalidate <node-id> [--reason <text>]\n";

const parseArgs = (args: readonly string[]): { nodeId: string; evidenceId: string } => {
  const parsed = parseOptions(
    args,
    [
      { name: "reason", takesValue: true },
      { name: "by", takesValue: true },
    ],
    INVALIDATE_USAGE.trim(),
  );
  if (parsed.positionals.length !== 1 || parsed.flags.size > 0) {
    throw syntaxError(INVALIDATE_USAGE.trim());
  }
  const reason = parsed.values.get("reason");
  const evidenceId = parsed.values.get("by");
  if (reason !== undefined && evidenceId !== undefined) {
    throw syntaxError("Specify only one invalidation explanation.");
  }
  const explanation = reason ?? evidenceId;
  if (explanation === undefined || explanation.trim() === "") {
    throw syntaxError("Invalidation requires --reason <text>.");
  }
  return { nodeId: parsed.positionals[0]!, evidenceId: explanation };
};

export async function runInvalidation(
  args: readonly string[],
  io: CliIO,
): Promise<number> {
  if (hasHelp(args)) {
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
