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

  it("excludes terminal nodes and DECIDED provenance nodes from the frontier table", () => {
    const fixtureGraph = {
      nodes: [
        {
          id: "TASK-001",
          type: "TASK" as const,
          provenance_type: "FACT" as const,
          statement: "An open unresolved task",
        },
        {
          id: "UNK-001",
          type: "UNK" as const,
          provenance_type: "UNKNOWN" as const,
          status: "RESOLVED",
          statement: "A resolved unknown",
        },
        {
          id: "CAN-001",
          type: "CAN" as const,
          provenance_type: "PROPOSED" as const,
          status: "REJECTED",
          statement: "A rejected candidate",
        },
        {
          id: "DEC-001",
          type: "DEC" as const,
          provenance_type: "DECIDED" as const,
          statement: "A decided decision",
        },
        {
          id: "ASM-001",
          type: "ASM" as const,
          provenance_type: "ASSUMED" as const,
          status: "INVALIDATED",
          statement: "An invalidated assumption",
        },
        {
          id: "CLM-001",
          type: "CLM" as const,
          provenance_type: "PROPOSED" as const,
          status: "REMOVED",
          statement: "A removed claim",
        },
      ],
      edges: [],
    };

    const rendered = renderIndex(fixtureGraph);
    expect(rendered).toContain("TASK-001");
    expect(rendered).not.toContain("UNK-001");
    expect(rendered).not.toContain("CAN-001");
    expect(rendered).not.toContain("DEC-001");
    expect(rendered).not.toContain("ASM-001");
    expect(rendered).not.toContain("CLM-001");
  });

  it("renders an unresolved node that sorts after 25 terminal nodes", () => {
    const terminalNodes = Array.from({ length: 25 }, (_, index) => ({
      id: `CAN-${String(index + 1).padStart(3, "0")}`,
      type: "CAN" as const,
      provenance_type: "PROPOSED" as const,
      status: "REJECTED",
      statement: `Rejected candidate ${index + 1}`,
    }));
    const openNode = {
      id: "UNK-z-last",
      type: "UNK" as const,
      provenance_type: "UNKNOWN" as const,
      statement: "An open unknown sorting after all candidates",
    };

    const rendered = renderIndex({
      nodes: [...terminalNodes, openNode],
      edges: [],
    });

    expect(rendered).toContain("UNK-z-last");
  });

  it("reports a deterministic omitted count when frontier rows exceed 25", () => {
    const frontierNodes = Array.from({ length: 30 }, (_, index) => ({
      id: `TASK-${String(index + 1).padStart(3, "0")}`,
      type: "TASK" as const,
      provenance_type: "FACT" as const,
      statement: `Task ${index + 1}`,
    }));

    const rendered = renderIndex({
      nodes: frontierNodes,
      edges: [],
    });

    expect(rendered).toContain("TASK-001");
    expect(rendered).toContain("TASK-025");
    expect(rendered).not.toContain("TASK-026");
    expect(rendered).toContain("Omitted 5 additional frontier nodes for compactness.");
    expect(rendered.split(/\s+/u).length).toBeLessThan(500);
  });
});
