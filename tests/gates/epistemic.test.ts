import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import { runEpistemicGate } from "../../src/gates/epistemic-gate.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";

const node = (
  id: string,
  type: Node["type"],
  provenance_type: Node["provenance_type"],
  extra: Record<string, unknown> = {},
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type,
    statement: id,
    ...extra,
  });

const graph = (
  nodes: Node[],
  edges: MaterializedGraph["edges"] = [],
): MaterializedGraph => ({ nodes, edges });

describe("runEpistemicGate", () => {
  it("rejects a unit-test result for a throughput claim", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "Throughput & Latency",
            minimum_rung: 7,
          }),
          node("EVD-1", "EVD", "MEASURED", {
            method: "unit test",
            rung: 3,
            verdict: "SUPPORTED",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSUFFICIENT_EVIDENCE",
          requestId: "EVDREQ-1",
          evidenceId: "EVD-1",
          required: 7,
          actual: 3,
        }),
      ]),
    );
  });

  it("accepts evidence at the minimum mapped rung", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "ThroughputCapacity",
          }),
          node("EVD-1", "EVD", "MEASURED", {
            rung: 7,
            verdict: "SUPPORTED",
            method: "load benchmark",
            receipt: "receipt-1",
            environment: "ci-node-20",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("rejects a locked decision that depends on ASSUMED or UNKNOWN provenance", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("DEC-1", "DEC", "DECIDED", { adversarial_critique: "Reviewed" }),
          node("ASM-1", "ASM", "ASSUMED"),
          node("UNK-1", "UNK", "UNKNOWN"),
        ],
        [
          { source: "DEC-1", target: "ASM-1", type: "depends_on" },
          { source: "DEC-1", target: "UNK-1", type: "depends_on" },
        ],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNRESOLVED_DECISION_DEPENDENCY",
          nodeId: "DEC-1",
          dependencyId: "ASM-1",
        }),
        expect.objectContaining({ dependencyId: "UNK-1" }),
      ]),
    );
  });

  it("requires a non-empty adversarial critique before locking DEC or CAN", () => {
    const result = runEpistemicGate(
      graph([
        node("DEC-1", "DEC", "DECIDED"),
        node("CAN-1", "CAN", "DECIDED", { adversarial_critique: "  " }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_ADVERSARIAL_CRITIQUE", nodeId: "DEC-1" }),
        expect.objectContaining({ code: "MISSING_ADVERSARIAL_CRITIQUE", nodeId: "CAN-1" }),
      ]),
    );
  });
});
