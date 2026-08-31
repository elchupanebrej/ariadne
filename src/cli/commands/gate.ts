import {
  EpistemicGateEngine,
  type GateCommand,
  type GateName,
  type GateReceipt,
  type GateResult,
} from "../../gates/gate-engine.js";
import { hasHelp, resolveCliWorkspace } from "../workspace.js";
import type { CliIO } from "../workspace.js";

export type { GateCommand, GateName, GateReceipt, GateResult };

const GATE_USAGE = "Usage: ariadne gate <structural|semantic|epistemic|decision-scope|all> [--strict]\n";

const parse = (args: readonly string[]): { gate: GateCommand; strict: boolean } => {
  const [gate, ...options] = args;
  if (
    gate !== "structural" &&
    gate !== "semantic" &&
    gate !== "epistemic" &&
    gate !== "decision-scope" &&
    gate !== "all"
  ) {
    throw new Error(`Unknown gate: ${gate ?? ""}`.trim());
  }
  if (options.some((option) => option !== "--strict") || options.length > 1) {
    throw new Error(GATE_USAGE.trim());
  }
  return { gate, strict: options.length === 1 };
};

export async function runGate(args: readonly string[], io: CliIO): Promise<number> {
  if (hasHelp(args)) {
    io.stdout.write(GATE_USAGE);
    return 0;
  }
  const { gate, strict } = parse(args);
  const { graph } = await resolveCliWorkspace(io);

  const receipt = await graph.gate({ gate, strict });

  io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  return receipt.passed ? 0 : 1;
}
