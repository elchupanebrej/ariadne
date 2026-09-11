import { describe, expect, it } from "vitest";
import { buildViz } from "../../src/cli/commands/viz.js";
import { buildReport, answerText } from "../../src/graph/report-engine.js";
import {
  buildStatusReport,
  buildContinuation,
} from "../../src/cli/commands/status.js";
import { EpistemicGateEngine } from "../../src/gates/gate-engine.js";
import { runEpistemicGate } from "../../src/gates/epistemic-gate.js";
import { runSemanticGate } from "../../src/gates/semantic-gate.js";
import { renderCard, type GraphEvent, type MaterializedGraph } from "../../src/graph/storage.js";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";

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
    statement: `Statement for ${id}`,
    ...extra,
  });

const nodeEvent = (id: string, fields: Record<string, unknown> = {}): GraphEvent => ({
  kind: "node",
  node: {
    id,
    type: id.split("-")[0],
    provenance_type: "PROPOSED",
    statement: `Statement for ${id}. Second sentence.`,
    ...fields,
  } as never,
});

const edgeEvent = (source: string, type: string, target: string): GraphEvent => ({
  kind: "edge",
  edge: { source, target, type } as never,
});

describe("Ticket 05: Terminal status integration across projections and gates", () => {
  describe("Visualization (ariadne viz / buildViz)", () => {
    it("recognizes WAIVED and SUPERSEDED as terminal node statuses", () => {
      const events: GraphEvent[] = [
        nodeEvent("FRAME-1", { type: "FRAME", provenance_type: "FACT", status: "ACTIVE" }),
        nodeEvent("DEC-1", {
          type: "DEC",
          provenance_type: "DECIDED",
          status: "SUPERSEDED",
          superseded_by: "DEC-2",
        }),
        nodeEvent("DEC-2", {
          type: "DEC",
          provenance_type: "DECIDED",
          status: "DECIDED",
          adversarial_critique: "Sound.",
        }),
        nodeEvent("UNK-1", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "WAIVED",
          waived_by: "DEC-2",
        }),
        nodeEvent("UNK-2", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "RESOLVED",
          resolved_by: "DEC-2",
        }),
        nodeEvent("UNK-OPEN", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "OPEN",
        }),
        nodeEvent("CAN-1", { type: "CAN", provenance_type: "PROPOSED", status: "ACTIVE" }),
        edgeEvent("DEC-2", "derived_from", "FRAME-1"),
        edgeEvent("CAN-1", "derived_from", "FRAME-1"),
        edgeEvent("UNK-OPEN", "references", "FRAME-1"),
        edgeEvent("UNK-1", "references", "FRAME-1"),
      ];

      const viz = buildViz(events, { cardsPrefix: "../cards" });

      // Frontier header: Open unknowns should only count UNK-OPEN (1), excluding UNK-1 (WAIVED) and UNK-2 (RESOLVED)
      expect(viz.html).toContain("Open unknowns: 1");
      expect(viz.html).toContain("UNK-OPEN");
      expect(viz.html).not.toContain("UNK-1.md</a> —");
      expect(viz.html).not.toContain("UNK-2.md</a> —");

      // Active count should exclude WAIVED, SUPERSEDED, RESOLVED, DECIDED
      // Active nodes: FRAME-1, UNK-OPEN, CAN-1 = 3 active nodes
      expect(viz.html).toContain("Active: 3");

      // Status badges should include status-waived and status-superseded classes
      expect(viz.html).toMatch(/class="status-badge status-waived">WAIVED<\/span>/);
      expect(viz.html).toMatch(/class="status-badge status-superseded">SUPERSEDED<\/span>/);

      // Card answers in viz
      expect(viz.html).toContain("waived by DEC-2");
      expect(viz.html).toContain("superseded by DEC-2");
    });
  });

  describe("Report engine (answerText and buildReport)", () => {
    it("answerText formats waived unknowns and superseded decisions correctly", () => {
      const waivedNode = node("UNK-1", "UNK", "UNKNOWN", {
        status: "WAIVED",
        waived_by: "DEC-1",
      });
      const resolvedNode = node("UNK-2", "UNK", "UNKNOWN", {
        status: "RESOLVED",
        resolved_by: "DEC-1",
      });
      const openNode = node("UNK-3", "UNK", "UNKNOWN", { status: "OPEN" });
      const supersededDec = node("DEC-1", "DEC", "DECIDED", {
        status: "SUPERSEDED",
        superseded_by: "DEC-2",
      });
      const liveDec = node("DEC-2", "DEC", "DECIDED", {
        statement: "Live decision statement. Extra text.",
      });

      expect(answerText(waivedNode)).toBe("waived by DEC-1");
      expect(answerText(resolvedNode)).toBe("resolved by DEC-1");
      expect(answerText(openNode)).toBe("UNRESOLVED");
      expect(answerText(supersededDec)).toBe("superseded by DEC-2");
      expect(answerText(liveDec)).toBe("Live decision statement.");
    });

    it("buildReport displays waived by <DEC> and superseded by <DEC> in report tree output", () => {
      const events: GraphEvent[] = [
        nodeEvent("FRAME-1", { type: "FRAME", provenance_type: "FACT", status: "ACTIVE" }),
        nodeEvent("DEC-1", {
          type: "DEC",
          provenance_type: "DECIDED",
          status: "SUPERSEDED",
          superseded_by: "DEC-2",
        }),
        nodeEvent("DEC-2", {
          type: "DEC",
          provenance_type: "DECIDED",
          status: "DECIDED",
          statement: "Canonical decision chosen.",
        }),
        nodeEvent("UNK-1", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "WAIVED",
          waived_by: "DEC-2",
        }),
        edgeEvent("DEC-2", "derived_from", "FRAME-1"),
        edgeEvent("DEC-1", "derived_from", "FRAME-1"),
        edgeEvent("UNK-1", "references", "DEC-2"),
      ];

      const report = buildReport(events, { cardsPrefix: ".ariadne/cards" });

      expect(report.text).toMatch(/UNK-1 \[WAIVED\][^\n]*\n[^\n]*~ waived by DEC-2/);
      expect(report.text).toMatch(/DEC-1 \[SUPERSEDED\][^\n]*\n[^\n]*~ superseded by DEC-2/);
    });
  });

  describe("Status command (buildStatusReport and buildContinuation)", () => {
    it("excludes WAIVED unknowns and SUPERSEDED decisions from open unknowns and frontier", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("TASK-1", "TASK", "FACT", { status: "ACTIVE" }),
          node("UNK-WAIVED", "UNK", "UNKNOWN", { status: "WAIVED", waived_by: "DEC-1" }),
          node("UNK-OPEN", "UNK", "UNKNOWN", { status: "OPEN" }),
          node("DEC-SUPERSEDED", "DEC", "DECIDED", {
            status: "SUPERSEDED",
            superseded_by: "DEC-LIVE",
          }),
          node("DEC-LIVE", "DEC", "DECIDED", { status: "DECIDED" }),
        ],
        edges: [],
      };

      const status = buildStatusReport(null, graph);

      expect(status.frontier).toContain("TASK-1");
      expect(status.frontier).toContain("UNK-OPEN");
      expect(status.frontier).not.toContain("UNK-WAIVED");
      expect(status.frontier).not.toContain("DEC-SUPERSEDED");
      expect(status.open_unknowns).toEqual(["UNK-OPEN"]);
    });

    it("does not produce false insufficient-information or blocked-dependency continuations for waived nodes", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("FRAME-1", "FRAME", "FACT", { status: "ACTIVE" }),
          node("CAN-1", "CAN", "PROPOSED", { status: "ACTIVE", dependencies: ["UNK-1", "DEC-OLD"] }),
          node("UNK-1", "UNK", "UNKNOWN", { status: "WAIVED", waived_by: "DEC-NEW" }),
          node("DEC-OLD", "DEC", "DECIDED", { status: "SUPERSEDED", superseded_by: "DEC-NEW" }),
          node("EVD-1", "EVD", "MEASURED", { verdict: "SUPPORTED", status: "OBSERVED" }),
        ],
        edges: [
          { source: "CAN-1", target: "FRAME-1", type: "derived_from" },
          { source: "CAN-1", target: "UNK-1", type: "depends_on" },
          { source: "CAN-1", target: "DEC-OLD", type: "depends_on" },
          { source: "EVD-1", target: "CAN-1", type: "supports" },
        ],
      };

      const continuation = buildContinuation(graph, "FRAME-1");

      // Because UNK-1 is WAIVED and DEC-OLD is SUPERSEDED, they are terminal
      // and do not block CAN-1 as unmet dependencies, nor do they trigger insufficient-information.
      // CAN-1 is supported by EVD-1 and has no live unmet dependencies -> ready to record decision!
      expect(continuation).not.toBeNull();
      expect(continuation?.readiness_class).toBe("ready");
    });
  });

  describe("Gate verification (EpistemicGateEngine, semantic gate, epistemic gate)", () => {
    it("semantic gate isActive treats WAIVED and SUPERSEDED as inactive", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("CTR-1", "CTR", "FACT", { status: "ACTIVE" }),
          node("CAN-WAIVED", "CAN", "PROPOSED", { status: "WAIVED" }),
          node("CAN-SUPERSEDED", "CAN", "PROPOSED", { status: "SUPERSEDED" }),
        ],
        edges: [],
      };

      // Since CAN-WAIVED and CAN-SUPERSEDED are inactive, they should not satisfy candidate requirements
      const result = runSemanticGate(graph);
      expect(result.passed).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "CTR_CANDIDATE_CARDINALITY",
            actual: 0,
          }),
        ]),
      );
    });

    it("epistemic gate UNRESOLVED_DECISION_DEPENDENCY is not triggered by WAIVED or RESOLVED unknowns", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("DEC-1", "DEC", "DECIDED", {
            status: "DECIDED",
            adversarial_critique: "Critique provided",
          }),
          node("UNK-WAIVED", "UNK", "UNKNOWN", {
            status: "WAIVED",
            waived_by: "DEC-1",
          }),
          node("UNK-RESOLVED", "UNK", "UNKNOWN", {
            status: "RESOLVED",
            resolved_by: "DEC-1",
          }),
        ],
        edges: [
          { source: "DEC-1", target: "UNK-WAIVED", type: "depends_on" },
          { source: "DEC-1", target: "UNK-RESOLVED", type: "depends_on" },
        ],
      };

      const result = runEpistemicGate(graph);
      const unresolvedDiagnostics = result.diagnostics.filter(
        (d) => d.code === "UNRESOLVED_DECISION_DEPENDENCY",
      );
      expect(unresolvedDiagnostics).toHaveLength(0);
    });

    it("epistemic gate flags dependencies on SUPERSEDED decisions with INVALID_DEPENDENCY_STATUS", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("DEC-LIVE", "DEC", "DECIDED", {
            status: "DECIDED",
            adversarial_critique: "Live critique",
          }),
          node("DEC-OLD", "DEC", "DECIDED", {
            status: "SUPERSEDED",
            superseded_by: "DEC-LIVE",
          }),
        ],
        edges: [{ source: "DEC-LIVE", target: "DEC-OLD", type: "depends_on" }],
      };

      const result = runEpistemicGate(graph);
      expect(result.passed).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "INVALID_DEPENDENCY_STATUS",
            dependencyId: "DEC-OLD",
          }),
        ]),
      );
    });

    it("epistemic gate does NOT flag dependencies on WAIVED unknowns with INVALID_DEPENDENCY_STATUS", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("DEC-LIVE", "DEC", "DECIDED", {
            status: "DECIDED",
            adversarial_critique: "Live critique",
          }),
          node("UNK-1", "UNK", "UNKNOWN", {
            status: "WAIVED",
            waived_by: "DEC-LIVE",
          }),
        ],
        edges: [{ source: "DEC-LIVE", target: "UNK-1", type: "depends_on" }],
      };

      const result = runEpistemicGate(graph);
      const invalidStatusDiagnostics = result.diagnostics.filter(
        (d) => d.code === "INVALID_DEPENDENCY_STATUS",
      );
      expect(invalidStatusDiagnostics).toHaveLength(0);
    });

    it("EpistemicGateEngine.verify passes for graph with WAIVED unknown and SUPERSEDED decision", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("DEC-OLD", "DEC", "DECIDED", {
            status: "SUPERSEDED",
            superseded_by: "DEC-NEW",
          }),
          node("DEC-NEW", "DEC", "DECIDED", {
            status: "DECIDED",
            adversarial_critique: "Thorough review performed",
          }),
          node("UNK-1", "UNK", "UNKNOWN", {
            status: "WAIVED",
            waived_by: "DEC-NEW",
          }),
        ],
        edges: [
          { source: "DEC-NEW", target: "DEC-OLD", type: "supersedes" },
          { source: "DEC-NEW", target: "UNK-1", type: "depends_on" },
        ],
      };

      const receipt = EpistemicGateEngine.verify(graph);
      expect(receipt.passed).toBe(true);
      expect(receipt.diagnostics).toHaveLength(0);
    });
  });

  describe("Legacy coexistence", () => {
    it("legacy graph containing hand-marked status: RESOLVED and resolved_by renders and passes gates alongside WAIVED nodes", () => {
      const graph: MaterializedGraph = {
        nodes: [
          node("DEC-1", "DEC", "DECIDED", {
            status: "DECIDED",
            adversarial_critique: "Legacy critique",
          }),
          node("UNK-LEGACY", "UNK", "UNKNOWN", {
            status: "RESOLVED",
            resolved_by: "DEC-1",
          }),
          node("UNK-WAIVED", "UNK", "UNKNOWN", {
            status: "WAIVED",
            waived_by: "DEC-1",
          }),
        ],
        edges: [
          { source: "DEC-1", target: "UNK-LEGACY", type: "depends_on" },
          { source: "DEC-1", target: "UNK-WAIVED", type: "depends_on" },
        ],
      };

      // 1. Gates pass
      const receipt = EpistemicGateEngine.verify(graph);
      expect(receipt.passed).toBe(true);
      expect(receipt.diagnostics).toHaveLength(0);

      // 2. Status report treats both as closed
      const status = buildStatusReport(null, graph);
      expect(status.open_unknowns).toHaveLength(0);
      expect(status.frontier).not.toContain("UNK-LEGACY");
      expect(status.frontier).not.toContain("UNK-WAIVED");

      // 3. Viz treats both as closed
      const events: GraphEvent[] = [
        nodeEvent("DEC-1", {
          type: "DEC",
          provenance_type: "DECIDED",
          status: "DECIDED",
          adversarial_critique: "Legacy critique",
        }),
        nodeEvent("UNK-LEGACY", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "RESOLVED",
          resolved_by: "DEC-1",
        }),
        nodeEvent("UNK-WAIVED", {
          type: "UNK",
          provenance_type: "UNKNOWN",
          status: "WAIVED",
          waived_by: "DEC-1",
        }),
      ];
      const viz = buildViz(events, { cardsPrefix: "../cards" });
      expect(viz.html).toContain("Open unknowns: 0");

      // 4. Report renders both closure references
      const report = buildReport(events, { cardsPrefix: ".ariadne/cards" });
      expect(report.text).toContain("resolved by DEC-1");
      expect(report.text).toContain("waived by DEC-1");
    });
  });

  describe("Card rendering (renderCard)", () => {
    it("displays closing reference in card payload for waived unknowns and superseded decisions", () => {
      const waivedNode = node("UNK-1", "UNK", "UNKNOWN", {
        status: "WAIVED",
        waived_by: "DEC-1",
      });
      const supersededNode = node("DEC-1", "DEC", "DECIDED", {
        status: "SUPERSEDED",
        superseded_by: "DEC-2",
      });

      const waivedCard = renderCard(waivedNode);
      expect(waivedCard).toContain("- Status: WAIVED");
      expect(waivedCard).toContain('"waived_by": "DEC-1"');

      const supersededCard = renderCard(supersededNode);
      expect(supersededCard).toContain("- Status: SUPERSEDED");
      expect(supersededCard).toContain('"superseded_by": "DEC-2"');
    });
  });
});
