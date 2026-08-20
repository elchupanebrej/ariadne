import { describe, expect, it } from "vitest";
import {
  generateIndex,
  renderIndex,
} from "../../src/graph/index-generator.js";

const graph = {
  nodes: [
    {
      id: "CAN-002",
      type: "CAN" as const,
      provenance_type: "PROPOSED" as const,
      statement: "A candidate mechanism",
    },
    {
      id: "UNK-001",
      type: "UNK" as const,
      provenance_type: "UNKNOWN" as const,
      statement: "A decision-significant unknown",
    },
  ],
  edges: [],
};

describe("compact graph index", () => {
  it("renders deterministic frontier, unknown, and candidate summaries", () => {
    const first = renderIndex(graph);
    const second = generateIndex(graph);

    expect(first).toBe(second);
    expect(first).toContain("UNK-001");
    expect(first).toContain("CAN-002");
    expect(first.split(/\s+/u).length).toBeLessThan(500);
  });
});
