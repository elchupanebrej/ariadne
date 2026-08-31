import { validateGraph, type GraphDiagnostic } from "../graph/integrity.js";
import {
  runSemanticGate,
  runSemanticPreflight,
  type SemanticDiagnostic,
  runDecisionScopeGate,
  type DecisionScopeDiagnostic,
} from "./semantic-gate.js";
import {
  runEpistemicGate,
  type EpistemicDiagnostic,
} from "./epistemic-gate.js";
import type { MaterializedGraph } from "../graph/storage.js";

export type GateName = "structural" | "semantic" | "epistemic" | "decision-scope";
export type GateCommand = GateName | "all";

export type GateDiagnostic = {
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

export interface GateVerificationOptions {
  gate?: GateCommand;
  strict?: boolean;
}

const ORDER: readonly GateName[] = ["structural", "semantic", "epistemic"];

const REMEDIATION_MAP: Record<string, string> = {
  INVALID_GRAPH: "Provide nodes and edges that satisfy the canonical graph shape.",
  INVALID_NODE: "Fix the node fields and canonical identifier before retrying.",
  DUPLICATE_NODE: "Keep one node event for each canonical node identifier.",
  INVALID_EDGE: "Fix the edge relation and endpoint fields before retrying.",
  MISSING_NODE: "Add the referenced node or remove the dangling edge.",
  CYCLE: "Replace the deductive cycle with an acyclic derivation.",
  CTR_SEPARATION_DIVERSITY:
    "Add three candidate mechanisms across distinct separation principles.",
  CTR_SEPARATION_PREFLIGHT:
    "Add candidates across the uncovered separation principles; the strict semantic gate remains authoritative.",
  CTR_CANDIDATE_CARDINALITY:
    "Add the missing structurally distinct candidate mechanisms before retrying.",
  HYP_FALSIFICATION_CONDITION: "Add an explicit falsification condition to the hypothesis.",
  HARD_REQUIREMENT_FAILED: "Remove the failed candidate before preference scoring.",
  UNKNOWN_CLAIM_CLASS: "Declare a supported claim class or minimum evidentiary rung.",
  MISSING_EVIDENCE_RUNG: "Record the Evidentiary Ladder rung for the evidence.",
  INSUFFICIENT_EVIDENCE: "Collect evidence at or above the required evidentiary rung.",
  UNRESOLVED_DECISION_DEPENDENCY: "Resolve dependency provenance before locking the decision.",
  MISSING_ADVERSARIAL_CRITIQUE: "Record an adversarial critique before locking the candidate.",
  DECISION_SCOPE_DIVERGENCE:
    "Reconcile the unresolved branch decision-scope contradiction before publishing authority.",
};

export const getRemediationHint = (code: string): string =>
  REMEDIATION_MAP[code] ?? "Inspect the diagnostic and satisfy its stated invariant.";

const withHints = <T extends { code: string; message: string }>(
  gate: GateName,
  diagnostics: readonly T[],
): GateDiagnostic[] =>
  diagnostics.map((diagnostic) => ({
    ...diagnostic,
    gate,
    remediation: getRemediationHint(diagnostic.code),
  }));

export class EpistemicGateEngine {
  /**
   * Run structural verification on a graph or raw structure.
   */
  static verifyStructural(input: unknown): GateResult {
    const result = validateGraph(input);
    return {
      gate: "structural",
      passed: result.valid,
      diagnostics: withHints("structural", result.diagnostics),
    };
  }

  /**
   * Run semantic verification on a materialized graph.
   */
  static verifySemantic(graph: MaterializedGraph): GateResult {
    const preflight = runSemanticPreflight(graph);
    const result = runSemanticGate(graph);
    return {
      gate: "semantic",
      passed: result.passed,
      diagnostics: [
        ...withHints("semantic", preflight),
        ...withHints("semantic", result.diagnostics),
      ],
    };
  }

  /**
   * Run epistemic verification (evidentiary ladder and claim validity) on a graph.
   */
  static verifyEpistemic(graph: MaterializedGraph): GateResult {
    const result = runEpistemicGate(graph);
    return {
      gate: "epistemic",
      passed: result.passed,
      diagnostics: withHints("epistemic", result.diagnostics),
    };
  }

  /** Run the read-only gate for unresolved branch decision scopes. */
  static verifyDecisionScope(graph: MaterializedGraph): GateResult {
    const result = runDecisionScopeGate(graph);
    return {
      gate: "decision-scope",
      passed: result.passed,
      diagnostics: withHints("decision-scope", result.diagnostics as DecisionScopeDiagnostic[]),
    };
  }

  /**
   * Run one or all verification gates and return a comprehensive GateReceipt.
   */
  static verify(
    graph: MaterializedGraph,
    options: GateVerificationOptions = {},
  ): GateReceipt {
    const gate = options.gate ?? "all";
    const strict = options.strict ?? false;
    const names = gate === "all" ? ORDER : [gate];

    const results: GateResult[] = [];
    for (const name of names) {
      switch (name) {
        case "structural":
          results.push(this.verifyStructural(graph));
          break;
        case "semantic":
          results.push(this.verifySemantic(graph));
          break;
        case "epistemic":
          results.push(this.verifyEpistemic(graph));
          break;
        case "decision-scope":
          results.push(this.verifyDecisionScope(graph));
          break;
      }
    }

    const diagnostics = results.flatMap((r) => r.diagnostics);
    return {
      gate,
      strict,
      passed: results.every((r) => r.passed),
      diagnostics,
      results,
    };
  }
}

/** Backwards-compatible structural gate helper */
export const runStructuralGate = (input: unknown): { passed: boolean; diagnostics: GraphDiagnostic[] } => {
  const res = validateGraph(input);
  return { passed: res.valid, diagnostics: res.diagnostics };
};
