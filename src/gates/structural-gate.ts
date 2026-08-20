import {
  validateGraph,
  type GraphDiagnostic,
} from "../graph/integrity.js";

export type StructuralGateResult = {
  passed: boolean;
  diagnostics: GraphDiagnostic[];
};

/** Run deterministic schema, reference, and deductive-DAG checks. */
export function runStructuralGate(input: unknown): StructuralGateResult {
  const result = validateGraph(input);
  return { passed: result.valid, diagnostics: result.diagnostics };
}
