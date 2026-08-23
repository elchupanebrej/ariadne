import { describe, expect, it } from "vitest";
import { runStructuralGate } from "../../src/gates/structural-gate.js";

const representativeGraph = () => ({
  nodes: Array.from({ length: 50 }, (_, index) => ({
    id: `CLM-prop-${index}`,
    type: "CLM",
    statement: `Claim ${index} about the reasoning layer`,
    provenance_type: "DERIVED",
    status: "active",
  })),
  edges: Array.from({ length: 49 }, (_, index) => ({
    source: `CLM-prop-${index}`,
    type: "supports",
    target: `CLM-prop-${index + 1}`,
  })),
});

describe("structural gate performance", () => {
  it("rejects invalid graphs and stays under the 50ms budget", () => {
    const valid = runStructuralGate(representativeGraph());
    expect(valid.passed).toBe(true);

    const invalid = runStructuralGate({
      nodes: [{ id: "not-a-node-id", type: "CLM", statement: "x", provenance_type: "DERIVED" }],
      edges: [],
    });
    expect(invalid.passed).toBe(false);

    const started = performance.now();
    for (let index = 0; index < 10; index += 1) {
      runStructuralGate(representativeGraph());
    }
    const elapsedPerRun = (performance.now() - started) / 10;
    expect(elapsedPerRun).toBeLessThan(50);
  });
});
