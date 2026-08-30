import { describe, expect, it } from "vitest";
import { EpistemicGateEngine } from "../../src/gates/gate-engine.js";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";

const node = (
  id: string,
  type: Node["type"] = "TASK",
  extra: Record<string, unknown> = {},
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type: "PROPOSED",
    statement: id,
    ...extra,
  });

const graph = (
  nodes: Node[],
  edges: MaterializedGraph["edges"] = [],
): MaterializedGraph => ({ nodes, edges });

describe("EpistemicGateEngine deep domain module", () => {
  it("verifies structural integrity with actionable remediation hints", () => {
    const validGraph = graph(
      [node("TASK-1"), node("HYP-1", "HYP")],
      [{ source: "TASK-1", target: "HYP-1", type: "depends_on" }],
    );

    const validResult = EpistemicGateEngine.verifyStructural(validGraph);
    expect(validResult.passed).toBe(true);
    expect(validResult.diagnostics).toEqual([]);

    const brokenGraph = graph([node("TASK-1")], [
      { source: "TASK-1", target: "HYP-999", type: "depends_on" },
    ]);

    const brokenResult = EpistemicGateEngine.verifyStructural(brokenGraph);
    expect(brokenResult.passed).toBe(false);
    expect(brokenResult.diagnostics).toHaveLength(1);
    expect(brokenResult.diagnostics[0]).toMatchObject({
      gate: "structural",
      code: "MISSING_NODE",
      remediation: "Add the referenced node or remove the dangling edge.",
    });
  });

  it("verifies semantic diversity and contradiction resolution rules", () => {
    const validCtrGraph = graph(
      [
        node("CTR-1", "CTR", { status: "ACTIVE" }),
        node("CAN-1", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "time",
        }),
        node("CAN-2", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "space",
        }),
        node("CAN-3", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "condition",
        }),
      ],
      [
        { source: "CAN-1", target: "CTR-1", type: "satisfies" },
        { source: "CAN-2", target: "CTR-1", type: "satisfies" },
        { source: "CAN-3", target: "CTR-1", type: "satisfies" },
      ],

    );

    const result = EpistemicGateEngine.verifySemantic(validCtrGraph);
    expect(result.passed).toBe(true);
  });

  it("runs comprehensive multi-gate verification with unified receipt", () => {
    const validGraph = graph(
      [
        node("TASK-1"),
        node("HYP-1", "HYP", { falsification_condition: "Latency exceeds 100ms" }),
      ],
      [{ source: "TASK-1", target: "HYP-1", type: "depends_on" }],
    );

    const receipt = EpistemicGateEngine.verify(validGraph, { gate: "all" });
    expect(receipt.gate).toBe("all");
    expect(receipt.passed).toBe(true);
    expect(receipt.results).toHaveLength(3);
    expect(receipt.results.map((r) => r.gate)).toEqual([
      "structural",
      "semantic",
      "epistemic",
    ]);
  });

});
