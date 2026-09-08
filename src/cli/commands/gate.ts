import {
  EpistemicGateEngine,
  type GateCommand,
  type GateName,
  type GateReceipt,
  type GateResult,
} from "../../gates/gate-engine.js";
import { hasHelp, parseOutputFormat, syntaxError, writeDomainDiagnostic } from "../contract.js";
import { resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";
import { assertNotLegacyWorkspace } from "../../graph/legacy.js";

export type { GateCommand, GateName, GateReceipt, GateResult };

const GATE_USAGE = "Usage: ariadne gate <name> [--format json]\n";

const parse = (args: readonly string[]): { gate: GateCommand; strict: boolean } => {
  const [gate, ...options] = args;
  if (
    gate !== "structural" &&
    gate !== "semantic" &&
    gate !== "epistemic" &&
    gate !== "decision-scope" &&
    gate !== "all"
  ) {
    throw syntaxError(`Unknown gate: ${gate ?? ""}`.trim());
  }
  if (options.some((option) => option !== "--strict") || options.length > 1) {
    throw syntaxError(GATE_USAGE.trim());
  }
  return { gate, strict: options.length === 1 };
};

export async function runGate(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(GATE_USAGE);
    return 0;
  }
  const output = parseOutputFormat(args, ["json"], "human", GATE_USAGE.trim());
  const strict = output.rest.includes("--strict");
  const remaining = output.rest.filter((arg) => arg !== "--strict");
  const { gate } = parse(remaining);
  const { environment, graph } = await resolveCliWorkspace(io);
  await assertNotLegacyWorkspace(environment.storageRoot);

  const receipt = await graph.gate({ gate, strict });

  io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!receipt.passed) {
    writeDomainDiagnostic(
      io,
      output.format,
      "GATE_FAILED",
      `Epistemic gate '${gate}' failed verification.`,
      { gate, diagnostics: receipt.diagnostics },
    );
  }
  return receipt.passed ? 0 : 1;
}
