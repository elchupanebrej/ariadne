import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import {
  validateGraph,
  type GraphValidationResult,
} from "../../src/graph/integrity.js";
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

describe("validateGraph", () => {
  it("accepts a graph with valid references and an acyclic deductive chain", () => {
    const result = validateGraph(
      graph(
        [node("TASK-1"), node("HYP-1", "HYP"), node("OBS-1", "OBS")],
        [
          { source: "TASK-1", target: "HYP-1", type: "depends_on" },
          { source: "HYP-1", target: "OBS-1", type: "derived_from" },
        ],
      ),
    );

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it("reports missing edge references with actionable diagnostics", () => {
    const result = validateGraph(
      graph([node("TASK-1")], [
        { source: "TASK-1", target: "HYP-404", type: "depends_on" },
      ]),
    );

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSING_NODE",
          nodeId: "HYP-404",
        }),
      ]),
    );
  });

  it.each(["depends_on", "derived_from"] as const)(
    "reports cycles formed by %s edges",
    (type) => {
      const result = validateGraph(
        graph(
          [node("TASK-1"), node("TASK-2")],
          [
            { source: "TASK-1", target: "TASK-2", type },
            { source: "TASK-2", target: "TASK-1", type },
          ],
        ),
      );

      expect(result.valid).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "CYCLE",
            path: ["TASK-1", "TASK-2", "TASK-1"],
          }),
        ]),
      );
    },
  );

  it("does not apply the DAG invariant to non-deductive relations", () => {
    const result: GraphValidationResult = validateGraph(
      graph(
        [node("TASK-1"), node("TASK-2")],
        [
          { source: "TASK-1", target: "TASK-2", type: "supports" },
          { source: "TASK-2", target: "TASK-1", type: "supports" },
        ],
      ),
    );

    expect(result).toEqual({ valid: true, diagnostics: [] });
  });

  it("returns schema diagnostics instead of throwing for malformed graphs", () => {
    const result = validateGraph({
      nodes: [{ id: "bad", type: "TASK" }],
      edges: [],
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_NODE", nodeId: "bad" }),
      ]),
    );
  });
});
