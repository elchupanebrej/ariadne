import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import { runStructuralGate } from "../../src/gates/structural-gate.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";

const node = (id: string, type: Node["type"] = "TASK"): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type: "PROPOSED",
    statement: id,
  });

const graph = (
  nodes: Node[],
  edges: MaterializedGraph["edges"] = [],
): MaterializedGraph => ({ nodes, edges });

describe("runStructuralGate", () => {
  it("passes a schema-valid, referentially sound acyclic graph", () => {
    const result = runStructuralGate(
      graph(
        [node("TASK-1"), node("HYP-1", "HYP")],
        [{ source: "TASK-1", target: "HYP-1", type: "depends_on" }],
      ),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("returns actionable diagnostics for invalid structure", () => {
    const result = runStructuralGate(
      graph([node("TASK-1")], [
        { source: "TASK-1", target: "HYP-404", type: "depends_on" },
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_NODE", nodeId: "HYP-404" }),
      ]),
    );
  });
});
