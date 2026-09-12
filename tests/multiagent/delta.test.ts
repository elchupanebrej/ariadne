import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import {
  extractDeltaBlocks,
  mergeDelta,
} from "../../src/multiagent/delta.js";

const block = (info: string, payload: unknown): string =>
  `\`\`\`${info}\n${JSON.stringify(payload)}\n\`\`\``;

const node = (id: string) => ({
  id,
  type: "TASK" as const,
  provenance_type: "PROPOSED" as const,
  statement: id,
});

const edge = (source: string, target: string) => ({
  source,
  target,
  type: "depends_on" as const,
});

const workspace = async () => {
  const directory = await mkdtemp(join(tmpdir(), "ariadne-delta-"));
  return { directory, graph: EpistemicGraph.open(directory) };
};

describe("mergeDelta", () => {
  it("extracts multiple supported fences and applies one atomic batch", async () => {
    const { directory, graph } = await workspace();
    try {
      const response = [
        block("json ariadne-delta", { nodes: [node("TASK-1")], edges: [] }),
        block("ariadne-delta", {
          nodes: [node("TASK-2")],
          edges: [edge("TASK-2", "TASK-1")],
        }),
      ].join("\n");

      expect(extractDeltaBlocks(response)).toHaveLength(2);
      await expect(mergeDelta(graph, response)).resolves.toEqual({
        applied: {
          nodes: ["TASK-1", "TASK-2"],
          edges: ["TASK-2:depends_on:TASK-1"],
        },
        skipped: { nodes: [], edges: [] },
      });
      expect((await graph.materialize()).nodes.map(({ id }) => id)).toEqual([
        "TASK-1",
        "TASK-2",
      ]);
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toContain(
        "TASK-1",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("skips identical nodes and edges on repeat without new events", async () => {
    const { directory, graph } = await workspace();
    try {
      const response = block("json ariadne-delta", {
        nodes: [node("TASK-1")],
        edges: [],
      });
      await mergeDelta(graph, response);
      const before = await graph.readEvents();

      await expect(mergeDelta(graph, response)).resolves.toEqual({
        applied: { nodes: [], edges: [] },
        skipped: { nodes: ["TASK-1"], edges: [] },
      });
      expect(await graph.readEvents()).toEqual(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects concurrent conflicting merges and keeps identical merges idempotent", async () => {
    const { directory, graph } = await workspace();
    try {
      const response = block("ariadne-delta", {
        nodes: [node("TASK-1")],
        edges: [],
      });
      const otherGraph = EpistemicGraph.open(directory);
      const receipts = await Promise.all([
        mergeDelta(graph, response),
        mergeDelta(otherGraph, response),
      ]);

      expect(receipts.map(({ applied }) => applied.nodes)).toEqual([
        ["TASK-1"],
        [],
      ]);
      expect(receipts[1].skipped.nodes).toEqual(["TASK-1"]);
      expect(await otherGraph.readEvents()).toHaveLength(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects conflicting IDs and invalid graphs without changing files", async () => {
    const { directory, graph } = await workspace();
    try {
      await mergeDelta(
        graph,
        block("ariadne-delta", { nodes: [node("TASK-1")], edges: [] }),
      );
      const graphBefore = await readFile(join(directory, "GRAPH.jsonl"), "utf8");
      const indexBefore = await readFile(join(directory, "INDEX.md"), "utf8");

      await expect(
        mergeDelta(
          graph,
          block("json ariadne-delta", {
            nodes: [{ ...node("TASK-1"), statement: "conflict" }],
            edges: [],
          }),
        ),
      ).rejects.toThrow(/conflicting node ID/i);
      await expect(
        mergeDelta(
          graph,
          block("json ariadne-delta", {
            nodes: [node("TASK-2")],
            edges: [edge("TASK-1", "TASK-2"), edge("TASK-2", "TASK-1")],
          }),
        ),
      ).rejects.toThrow(/invalid graph|cycle/i);

      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        graphBefore,
      );
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toBe(
        indexBefore,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects malformed or non-strict delta blocks before writing", async () => {
    const { directory, graph } = await workspace();
    try {
      await expect(mergeDelta(graph, "```json ariadne-delta\n{broken\n```")).rejects.toThrow(
        /invalid JSON/i,
      );
      await expect(
        mergeDelta(
          graph,
          block("json ariadne-delta", {
            nodes: [],
            edges: [],
            unexpected: true,
          }),
        ),
      ).rejects.toThrow(/delta/i);
      await expect(mergeDelta(graph, "```json\n{}\n```")).rejects.toThrow(
        /ariadne-delta/i,
      );
      expect(await graph.readEvents()).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("applies schema-validated status and invalidation mutations idempotently", async () => {
    const { directory, graph } = await workspace();
    try {
      await mergeDelta(
        graph,
        block("ariadne-delta", { nodes: [node("TASK-1")], edges: [] }),
      );
      const response = block("ariadne-delta", {
        nodes: [],
        edges: [],
        mutations: [
          {
            node_id: "TASK-1",
            expected_status: null,
            status: "INVALIDATED",
            invalidation: { evidence_id: "EVD-1", reason: "falsified" },
          },
        ],
      });

      await expect(mergeDelta(graph, response)).resolves.toMatchObject({
        applied: { nodes: ["TASK-1"] },
      });
      const before = await graph.readEvents();
      await expect(mergeDelta(graph, response)).resolves.toMatchObject({
        skipped: { nodes: ["TASK-1"] },
      });
      expect(await graph.readEvents()).toEqual(before);
      expect((await graph.materialize()).nodes[0]).toMatchObject({
        id: "TASK-1",
        status: "INVALIDATED",
        invalidation: { evidence_id: "EVD-1" },
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rejects a stale status precondition without changing the graph", async () => {
    const { directory, graph } = await workspace();
    try {
      await mergeDelta(
        graph,
        block("ariadne-delta", {
          nodes: [{ ...node("TASK-1"), status: "READY" }],
          edges: [],
        }),
      );
      const before = await graph.readEvents();

      await expect(
        mergeDelta(
          graph,
          block("ariadne-delta", {
            nodes: [],
            edges: [],
            mutations: [
              {
                node_id: "TASK-1",
                expected_status: null,
                status: "INVALIDATED",
              },
            ],
          }),
        ),
      ).rejects.toThrow(/mutation conflict|expected status/i);
      expect(await graph.readEvents()).toEqual(before);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("applies a delta through the EpistemicGraph batch handle", async () => {
    const graph = EpistemicGraph.inMemory();
    const response = block("ariadne-delta", {
      nodes: [node("TASK-ENGINE")],
      edges: [],
    });

    await expect(mergeDelta(graph, response)).resolves.toMatchObject({
      applied: { nodes: ["TASK-ENGINE"] },
    });
    expect((await graph.materialize()).nodes.map(({ id }) => id)).toEqual([
      "TASK-ENGINE",
    ]);
  });

  it("rejects DEC status transitions without authorization", async () => {
    const { directory, graph } = await workspace();
    try {
      await mergeDelta(
        graph,
        block("ariadne-delta", {
          nodes: [
            {
              id: "DEC-1",
              type: "DEC",
              provenance_type: "DECIDED",
              statement: "DEC-1",
              status: "DECIDED",
            },
          ],
          edges: [],
        }),
      );

      await expect(
        mergeDelta(
          graph,
          block("ariadne-delta", {
            nodes: [],
            edges: [],
            mutations: [
              {
                node_id: "DEC-1",
                expected_status: "DECIDED",
                status: "RE-OPENED",
              },
            ],
          }),
        ),
      ).rejects.toThrow(/DEC status transition|authorization/i);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
