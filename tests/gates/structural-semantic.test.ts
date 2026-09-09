import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import { runStructuralGate } from "../../src/gates/gate-engine.js";
import { runSemanticGate } from "../../src/gates/semantic-gate.js";

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

describe("runSemanticGate", () => {
  it("passes an active contradiction with three distinct linked principles", () => {
    const result = runSemanticGate(
      graph(
        [
          node("CTR-1", "CTR", { status: "ACTIVE" }),
          node("CAN-1", "CAN", {
            contradiction_ref: "CTR-1",
            separation_principle: "Space",
          }),
          node("CAN-2", "CAN", {
            contradiction_ref: "CTR-1",
            separation_principle: "Time",
          }),
          node("CAN-3", "CAN", {
            contradiction_ref: "CTR-1",
            separation_principle: "State",
          }),
          node("HYP-1", "HYP", {
            falsification_conditions: ["p99 exceeds the limit"],
          }),
        ],
        [
          { source: "CAN-1", target: "CTR-1", type: "supports" },
          { source: "CAN-2", target: "CTR-1", type: "supports" },
          { source: "CAN-3", target: "CTR-1", type: "supports" },
        ],
      ),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("rejects an active contradiction with fewer than three distinct principles", () => {
    const result = runSemanticGate(
      graph([
        node("CTR-1", "CTR", { status: "ACTIVE" }),
        node("CAN-1", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "Space",
        }),
        node("CAN-2", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "Time",
        }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CTR_SEPARATION_DIVERSITY" }),
      ]),
    );
  });

  it("falls back to all candidates when no candidate association exists", () => {
    const result = runSemanticGate(
      graph([
        node("CTR-1", "CTR", { status: "ACTIVE" }),
        node("CAN-1", "CAN", { separation_principle: "Space" }),
        node("CAN-2", "CAN", { separation_principle: "Time" }),
        node("CAN-3", "CAN", { separation_principle: "State" }),
      ]),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("keeps candidate diagnostics limited to associated candidates", () => {
    const result = runSemanticGate(
      graph(
        [
          node("CTR-1", "CTR", { status: "ACTIVE" }),
          node("CAN-1", "CAN", { separation_principle: "Space" }),
          node("CAN-2", "CAN", { separation_principle: "Time" }),
          node("CAN-3", "CAN", { separation_principle: "State" }),
        ],
        [{ source: "CTR-1", target: "CAN-2", type: "supports" }],
      ),
    );

    expect(result.diagnostics).toEqual([
      {
        code: "CTR_CANDIDATE_CARDINALITY",
        message: "Active contradiction CTR-1 requires at least 3 structurally distinct candidate mechanisms",
        nodeId: "CTR-1",
        required: 3,
        actual: 1,
        candidates: ["CAN-2"],
      },
      {
        code: "CTR_SEPARATION_DIVERSITY",
        message: "Active contradiction CTR-1 requires at least 3 distinct separation principles",
        nodeId: "CTR-1",
        required: 3,
        actual: 1,
        candidates: ["CAN-2"],
      },
    ]);
  });

  it("does not count invalidated candidates toward contradiction diversity", () => {
    const result = runSemanticGate(
      graph(
        [
          node("CTR-1", "CTR", { status: "ACTIVE" }),
          node("CAN-1", "CAN", {
            status: "INVALIDATED",
            contradiction_ref: "CTR-1",
            separation_principle: "Space",
          }),
          node("CAN-2", "CAN", {
            status: "INVALIDATED",
            contradiction_ref: "CTR-1",
            separation_principle: "Time",
          }),
          node("CAN-3", "CAN", {
            status: "STALE",
            contradiction_ref: "CTR-1",
            separation_principle: "State",
          }),
        ],
        [
          { source: "CAN-1", target: "CTR-1", type: "supports" },
          { source: "CAN-2", target: "CTR-1", type: "supports" },
          { source: "CAN-3", target: "CTR-1", type: "supports" },
        ],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CTR_SEPARATION_DIVERSITY" }),
      ]),
    );
  });

  it("uses the Fast depth threshold of one separation principle", () => {
    const result = runSemanticGate({
      depth_mode: "Fast",
      nodes: [
        node("CTR-1", "CTR", { status: "ACTIVE" }),
        node("CAN-1", "CAN", {
          contradiction_ref: "CTR-1",
          separation_principle: "Time",
        }),
      ],
      edges: [],
    });

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("requires falsification conditions for hypotheses", () => {
    const result = runSemanticGate(
      graph([node("HYP-1", "HYP")]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "HYP_FALSIFICATION_CONDITION" }),
      ]),
    );
  });

  it("does not allow a weighted score to compensate for a hard failure", () => {
    const result = runSemanticGate(
      graph([
        node("CAN-1", "CAN", {
          hard_requirements: [{ name: "latency", satisfied: false }],
          weighted_score: 0.99,
        }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "HARD_REQUIREMENT_FAILED" }),
      ]),
    );
  });
});
