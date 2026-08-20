import { join } from "node:path";
import {
  runEpistemicGate,
  type EpistemicDiagnostic,
} from "../../gates/epistemic-gate.js";
import {
  runSemanticGate,
  type SemanticDiagnostic,
} from "../../gates/semantic-gate.js";
import {
  runStructuralGate,
  type StructuralGateResult,
} from "../../gates/structural-gate.js";
import { GraphStorage, type MaterializedGraph } from "../../graph/storage.js";
import type { GraphDiagnostic } from "../../graph/integrity.js";
import type { CliIO } from "./status.js";

export type GateName = "structural" | "semantic" | "epistemic";
export type GateCommand = GateName | "all";

type GateDiagnostic = {
  code: string;
  message: string;
  gate: GateName;
  remediation: string;
  [key: string]: unknown;
};

export type GateResult = {
  gate: GateName;
  passed: boolean;
  diagnostics: GateDiagnostic[];
};

export type GateReceipt = {
  gate: GateCommand;
  strict: boolean;
  passed: boolean;
  diagnostics: GateDiagnostic[];
  results: GateResult[];
};

const ORDER: readonly GateName[] = ["structural", "semantic", "epistemic"];

const remediation: Record<string, string> = {
  INVALID_GRAPH: "Provide nodes and edges that satisfy the canonical graph shape.",
  INVALID_NODE: "Fix the node fields and canonical identifier before retrying.",
  DUPLICATE_NODE: "Keep one node event for each canonical node identifier.",
  INVALID_EDGE: "Fix the edge relation and endpoint fields before retrying.",
  MISSING_NODE: "Add the referenced node or remove the dangling edge.",
  CYCLE: "Replace the deductive cycle with an acyclic derivation.",
  CTR_SEPARATION_DIVERSITY:
    "Add three candidate mechanisms across distinct separation principles.",
  HYP_FALSIFICATION_CONDITION: "Add an explicit falsification condition to the hypothesis.",
  HARD_REQUIREMENT_FAILED: "Remove the failed candidate before preference scoring.",
  UNKNOWN_CLAIM_CLASS: "Declare a supported claim class or minimum evidentiary rung.",
  MISSING_EVIDENCE_RUNG: "Record the Evidentiary Ladder rung for the evidence.",
  INSUFFICIENT_EVIDENCE: "Collect evidence at or above the required evidentiary rung.",
  UNRESOLVED_DECISION_DEPENDENCY: "Resolve dependency provenance before locking the decision.",
  MISSING_ADVERSARIAL_CRITIQUE: "Record an adversarial critique before locking the candidate.",
};

const hintFor = (code: string): string =>
  remediation[code] ?? "Inspect the diagnostic and satisfy its stated invariant.";

const withHints = (
  gate: GateName,
  diagnostics: Array<GraphDiagnostic | SemanticDiagnostic | EpistemicDiagnostic>,
): GateDiagnostic[] =>
  diagnostics.map((diagnostic) => ({
    ...diagnostic,
    gate,
    remediation: hintFor(diagnostic.code),
  }));

const runOne = (gate: GateName, graph: MaterializedGraph): GateResult => {
  let result: StructuralGateResult | { passed: boolean; diagnostics: SemanticDiagnostic[] } | { passed: boolean; diagnostics: EpistemicDiagnostic[] };
  switch (gate) {
    case "structural":
      result = runStructuralGate(graph);
      break;
    case "semantic":
      result = runSemanticGate(graph);
      break;
    case "epistemic":
      result = runEpistemicGate(graph);
      break;
  }
  return {
    gate,
    passed: result.passed,
    diagnostics: withHints(gate, result.diagnostics),
  };
};

const parse = (args: readonly string[]): { gate: GateCommand; strict: boolean } => {
  const [gate, ...options] = args;
  if (gate !== "structural" && gate !== "semantic" && gate !== "epistemic" && gate !== "all") {
    throw new Error(`Unknown gate: ${gate ?? ""}`.trim());
  }
  if (options.some((option) => option !== "--strict") || options.length > 1) {
    throw new Error("Usage: ariadne gate <structural|semantic|epistemic|all> [--strict]");
  }
  return { gate, strict: options.length === 1 };
};

export async function runGate(args: readonly string[], io: CliIO): Promise<number> {
  const { gate, strict } = parse(args);
  const graph = await new GraphStorage(join(io.cwd, ".ariadne")).materialize();
  const names = gate === "all" ? ORDER : [gate];
  const results = names.map((name) => runOne(name, graph));
  const diagnostics = results.flatMap((result) => result.diagnostics);
  const receipt: GateReceipt = {
    gate,
    strict,
    passed: results.every((result) => result.passed),
    diagnostics,
    results,
  };
  io.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  return receipt.passed ? 0 : 1;
}
