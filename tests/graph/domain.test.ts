import { describe, expect, it } from "vitest";
import {
  applyEvents,
  edgeKey,
  isFrontierNode,
  isTerminalNode,
  parseGraphEventPayload,
  renderCard,
  renderIndex,
  stateForGraph,
  type GraphEvent,
} from "../../src/graph/domain.js";

const task = (id: string, patch: { statement?: string; status?: string } = {}) => ({
  id,
  type: "TASK" as const,
  provenance_type: "FACT" as const,
  statement: patch.statement ?? `Node ${id}`,
  ...(patch.status !== undefined ? { status: patch.status } : {}),
});

describe("applyEvents", () => {
  it("folds node events with last-write-wins and sorts nodes by id", () => {
    const events: GraphEvent[] = [
      { kind: "node", node: task("TASK-B") },
      { kind: "node", node: task("TASK-A") },
      { kind: "node", node: task("TASK-A", { statement: "Updated A" }) },
    ];

    const graph = applyEvents({ nodes: [], edges: [] }, events);

    expect(graph.nodes.map(({ id }) => id)).toEqual(["TASK-A", "TASK-B"]);
    expect(graph.nodes[0]?.statement).toBe("Updated A");
  });

  it("applies edge upserts and removes tombstoned edges", () => {
    const edge = { source: "TASK-A", type: "depends_on" as const, target: "TASK-B" };
    const inserted = applyEvents({ nodes: [], edges: [] }, [{ kind: "edge", edge }]);
    expect(inserted.edges).toEqual([edge]);

    const removed = applyEvents(inserted, [{ kind: "edge", edge, tombstone: true }]);
    expect(removed.edges).toEqual([]);
  });
});

describe("edgeKey", () => {
  it("distinguishes edges by source, type, and target", () => {
    expect(edgeKey({ source: "TASK-A", type: "depends_on", target: "TASK-B" })).not.toBe(
      edgeKey({ source: "TASK-B", type: "depends_on", target: "TASK-A" }),
    );
  });
});

describe("frontier and terminal semantics", () => {
  it("treats closing references, terminal statuses, and tombstones as terminal", () => {
    expect(isTerminalNode({ provenance_type: "DECIDED" })).toBe(true);
    expect(isTerminalNode({ provenance_type: "PROPOSED", status: "waived" })).toBe(true);
    expect(isTerminalNode({ provenance_type: "FACT", tombstone: true })).toBe(true);
    expect(isTerminalNode({ provenance_type: "UNKNOWN", resolved_by: "DEC-1" })).toBe(true);
    expect(isTerminalNode({ provenance_type: "PROPOSED", superseded_by: "DEC-2" })).toBe(true);
  });

  it("keeps re-opened nodes on the frontier", () => {
    expect(isTerminalNode({ provenance_type: "FACT", status: "RE-OPENED" })).toBe(false);
    expect(isFrontierNode({ provenance_type: "FACT", status: "re-opened" })).toBe(true);
    expect(isFrontierNode({ provenance_type: "FACT" })).toBe(true);
  });
});

describe("stateForGraph", () => {
  const graph = {
    nodes: [
      task("TASK-open"),
      {
        id: "UNK-open",
        type: "UNK" as const,
        provenance_type: "UNKNOWN" as const,
        statement: "Open unknown",
      },
      {
        id: "UNK-closed",
        type: "UNK" as const,
        provenance_type: "UNKNOWN" as const,
        statement: "Closed unknown",
        status: "RESOLVED",
      },
    ],
    edges: [],
  };

  it("derives frontier and open unknowns from non-terminal nodes", () => {
    const state = stateForGraph({}, graph);

    expect(state).toEqual({
      frontier: ["TASK-open", "UNK-open"],
      open_unknowns: ["UNK-open"],
    });
  });

  it("refreshes overlay aliases only when the host declared them", () => {
    const state = stateForGraph(
      { depth_mode: "Standard", active_frontier: [], unknowns: [] },
      graph,
    );

    expect(state.depth_mode).toBe("Standard");
    expect(state.active_frontier).toEqual(["TASK-open", "UNK-open"]);
    expect(state.unknowns).toEqual(["UNK-open"]);
    expect(state).not.toHaveProperty("openUnknowns");
  });
});

describe("parseGraphEventPayload", () => {
  it("parses enveloped events and normalizes legacy payloads", () => {
    const node = task("TASK-1");
    const edge = { source: "TASK-1", type: "depends_on", target: "TASK-2" };

    expect(parseGraphEventPayload({ kind: "node", node })).toEqual({ kind: "node", node });
    expect(parseGraphEventPayload(node)).toEqual({ kind: "node", node });
    expect(parseGraphEventPayload(edge)).toEqual({ kind: "edge", edge });
    expect(parseGraphEventPayload({ nope: true })).toBeUndefined();
  });
});

describe("projection renderers", () => {
  it("renders the index from frontier nodes only", () => {
    const content = renderIndex({
      nodes: [
        task("TASK-open"),
        task("TASK-closed", { statement: "Closed task", status: "REJECTED" }),
      ],
      edges: [],
    });

    expect(content).toContain("TASK-open");
    expect(content).not.toContain("TASK-closed");
    expect(content).toContain("Nodes: 2 · Edges: 0");
  });

  it("renders a card header from canonical fields", () => {
    const card = renderCard(task("TASK-1", { statement: "Do the thing" }));

    expect(card).toContain("# TASK-1");
    expect(card).toContain("- Status: ACTIVE");
    expect(card).toContain("- Provenance: FACT");
    expect(card).toContain("Do the thing");
  });
});
