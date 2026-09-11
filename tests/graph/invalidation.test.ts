import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import {
  propagateInvalidation,
  type InvalidationGraph,
} from "../../src/graph/invalidation.js";

const node = (
  id: string,
  type: Node["type"],
  provenance_type: Node["provenance_type"],
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type,
    statement: id,
  });

const baseGraph = (): InvalidationGraph => ({
  nodes: [
    NodeSchema.parse({
      ...node("EVD-1", "EVD", "FACT"),
      verdict: "FALSIFIED",
      method: "load benchmark",
      rung: 7,
      receipt: "receipt-1",
      environment: "ci-node-20",
    }),
    node("ASM-1", "ASM", "ASSUMED"),
    node("TASK-1", "TASK", "DERIVED"),
    node("CAN-1", "CAN", "PROPOSED"),
    node("DEC-1", "DEC", "DECIDED"),
    node("CAN-2", "CAN", "PROPOSED"),
  ],
  edges: [
    { source: "EVD-1", target: "ASM-1", type: "falsifies" },
    { source: "TASK-1", target: "ASM-1", type: "depends_on" },
    { source: "CAN-1", target: "TASK-1", type: "derived_from" },
    { source: "DEC-1", target: "CAN-1", type: "depends_on" },
    { source: "ASM-1", target: "CAN-2", type: "supports" },
  ],
});

describe("propagateInvalidation", () => {
  it("marks the falsified premise and all downstream dependents", () => {
    const graph = baseGraph();
    const result = propagateInvalidation(graph, "ASM-1", "EVD-1");

    expect(result.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "ASM-1",
          status: "FALSIFIED",
          invalidation: expect.objectContaining({ evidence_id: "EVD-1" }),
        }),
        expect.objectContaining({ id: "CAN-1", status: "INVALIDATED" }),
        expect.objectContaining({ id: "CAN-2", status: "INVALIDATED" }),
        expect.objectContaining({
          id: "DEC-1",
          status: "RE-OPENED",
          invalidation: expect.objectContaining({ needs_review: true }),
        }),
      ]),
    );
    expect(result.trace.map(({ node_id }) => node_id)).toEqual([
      "ASM-1",
      "CAN-2",
      "TASK-1",
      "CAN-1",
      "DEC-1",
    ]);
    expect(graph.nodes.find(({ id }) => id === "ASM-1")?.status).toBeUndefined();
  });

  it("requires measured or factual evidence that falsifies the target", () => {
    const graph = baseGraph();
    graph.nodes = graph.nodes.map((candidate) =>
      candidate.id === "EVD-1"
        ? { ...candidate, provenance_type: "PROPOSED" }
        : candidate,
    );

    expect(() => propagateInvalidation(graph, "ASM-1", "EVD-1")).toThrow(
      /MEASURED or FACT/i,
    );
  });

  it("rejects incomplete falsifying evidence", () => {
    const graph = baseGraph();
    graph.nodes = graph.nodes.map((candidate) =>
      candidate.id === "EVD-1"
        ? { ...candidate, receipt: undefined }
        : candidate,
    );

    expect(() => propagateInvalidation(graph, "ASM-1", "EVD-1")).toThrow(
      /receipt/i,
    );
  });

  it("is deterministic and idempotent for the same falsification", () => {
    const first = propagateInvalidation(baseGraph(), "ASM-1", "EVD-1");
    const second = propagateInvalidation(first.graph, "ASM-1", "EVD-1");

    expect(second.trace).toEqual(first.trace);
    expect(second.graph).toEqual(first.graph);
  });

  it("cascades evidentiary re-open to waived unknowns and superseded decisions", () => {
    const graph = baseGraph();
    // Add UNK-1 waived by DEC-1, and DEC-2 superseded by DEC-1
    graph.nodes.push(
      NodeSchema.parse({
        ...node("UNK-1", "UNK", "UNKNOWN"),
        status: "WAIVED",
        waived_by: "DEC-1",
      }),
      NodeSchema.parse({
        ...node("DEC-2", "DEC", "DECIDED"),
        status: "SUPERSEDED",
        superseded_by: "DEC-1",
      }),
      NodeSchema.parse({
        ...node("UNK-OTHER", "UNK", "UNKNOWN"),
        status: "WAIVED",
        waived_by: "DEC-UNRELATED",
      }),
    );
    graph.edges.push({
      source: "DEC-1",
      target: "DEC-2",
      type: "supersedes",
    });

    const result = propagateInvalidation(graph, "ASM-1", "EVD-1");

    expect(result.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "DEC-1", status: "RE-OPENED" }),
        expect.objectContaining({
          id: "UNK-1",
          status: "RE-OPENED",
          invalidation: expect.objectContaining({
            evidence_id: "EVD-1",
            previous_status: "WAIVED",
            reopened_by_decision: "DEC-1",
          }),
        }),
        expect.objectContaining({
          id: "DEC-2",
          status: "RE-OPENED",
          invalidation: expect.objectContaining({
            evidence_id: "EVD-1",
            previous_status: "SUPERSEDED",
            reopened_by_decision: "DEC-1",
          }),
        }),
        expect.objectContaining({ id: "UNK-OTHER", status: "WAIVED" }),
      ]),
    );

    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "UNK-1",
          status: "RE-OPENED",
          previous_status: "WAIVED",
          relation: "waived_by",
        }),
        expect.objectContaining({
          node_id: "DEC-2",
          status: "RE-OPENED",
          previous_status: "SUPERSEDED",
          relation: "superseded_by",
        }),
      ]),
    );

    // Idempotent re-run with waived/superseded nodes
    const repeat = propagateInvalidation(result.graph, "ASM-1", "EVD-1");
    expect(repeat.trace).toEqual(result.trace);
    expect(repeat.graph).toEqual(result.graph);
  });
});
