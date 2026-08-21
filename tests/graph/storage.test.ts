import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GraphStorage } from "../../src/graph/storage.js";

const node = (id: string) => ({
  id,
  type: "TASK" as const,
  provenance_type: "FACT" as const,
  statement: `Node ${id}`,
});

describe("GraphStorage", () => {
  it("appends a validated batch and regenerates the index once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-batch-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.appendEvents([
        { kind: "node", node: node("TASK-001") },
        { kind: "node", node: node("TASK-002") },
        {
          kind: "edge",
          edge: {
            source: "TASK-002",
            type: "depends_on",
            target: "TASK-001",
          },
        },
      ]);

      expect(await storage.readEvents()).toHaveLength(3);
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toContain(
        "TASK-002",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recovers state and materialized graph after a restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.writeState({ depth_mode: "Standard", frontier: ["TASK-001"] });
      await storage.appendNode(node("TASK-001"));
      await storage.appendNode(node("TASK-002"));
      await storage.appendEdge({
        source: "TASK-002",
        type: "depends_on",
        target: "TASK-001",
      });

      const restarted = new GraphStorage(directory);
      expect(await restarted.readState()).toEqual({
        depth_mode: "Standard",
        frontier: ["TASK-001", "TASK-002"],
        open_unknowns: [],
      });
      expect(await restarted.materialize()).toEqual({
        nodes: [node("TASK-001"), node("TASK-002")],
        edges: [
          {
            source: "TASK-002",
            type: "depends_on",
            target: "TASK-001",
          },
        ],
      });
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toContain(
        "TASK-001",
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes concurrent appends without losing events", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-"));

    try {
      const storage = new GraphStorage(directory);
      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          storage.appendNode(node(`TASK-${String(index).padStart(3, "0")}`)),
        ),
      );

      const events = await storage.readEvents();
      expect(events).toHaveLength(20);
      expect((await storage.materialize()).nodes.map(({ id }) => id)).toEqual(
        Array.from({ length: 20 }, (_, index) =>
          `TASK-${String(index).padStart(3, "0")}`,
        ),
      );
      expect((await readFile(join(directory, "GRAPH.jsonl"), "utf8"))
        .trim()
        .split("\n")).toHaveLength(20);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("serializes read-check-append transactions across storage instances", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-transaction-"));

    try {
      const first = new GraphStorage(directory);
      const second = new GraphStorage(directory);
      const results = await Promise.all([
        first.transaction(async (graph) => {
          expect(graph.nodes).toHaveLength(0);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            result: "first",
            events: [{ kind: "node", node: node("TASK-001") }],
          };
        }),
        second.transaction((graph) => ({
          result: graph.nodes.map(({ id }) => id),
          events: [{ kind: "node", node: node("TASK-002") }],
        })),
      ]);

      expect(results).toEqual(["first", ["TASK-001"]]);
      expect((await second.materialize()).nodes.map(({ id }) => id)).toEqual([
        "TASK-001",
        "TASK-002",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("recovers an incomplete final JSONL record", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-recovery-"));

    try {
      const event = { kind: "node", node: node("TASK-001") };
      await writeFile(
        join(directory, "GRAPH.jsonl"),
        `${JSON.stringify(event)}\n{"kind":"node","node":{"id":"TASK-002"`,
        "utf8",
      );
      const storage = new GraphStorage(directory);

      expect(await storage.materialize()).toEqual({ nodes: [node("TASK-001")], edges: [] });
      expect(await readFile(join(directory, "GRAPH.jsonl"), "utf8")).toBe(
        `${JSON.stringify(event)}\n`,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("validates prospective references and deductive cycles before writing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-integrity-"));

    try {
      const storage = new GraphStorage(directory);
      await expect(
        storage.appendEdge({ source: "TASK-1", type: "depends_on", target: "TASK-2" }),
      ).rejects.toThrow(/missing node/i);
      expect(await storage.readEvents()).toEqual([]);

      await storage.appendEvents([
        { kind: "edge", edge: { source: "TASK-1", type: "depends_on", target: "TASK-2" } },
        { kind: "node", node: node("TASK-1") },
        { kind: "node", node: node("TASK-2") },
      ]);
      const beforeCycle = await storage.readEvents();
      await expect(
        storage.appendEvent({
          kind: "edge",
          edge: { source: "TASK-2", type: "depends_on", target: "TASK-1" },
        }),
      ).rejects.toThrow(/cycle/i);
      expect(await storage.readEvents()).toEqual(beforeCycle);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("validates state-owned fields while preserving overlay extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-state-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.writeState({
        mode: "gsd",
        depth_mode: "Deep",
        frontier: ["CAN-1"],
        gsd_extension: { phase: "01" },
      });
      await expect(storage.readState()).resolves.toMatchObject({
        gsd_extension: { phase: "01" },
      });
      await expect(storage.writeState({ depth_mode: "invalid" })).rejects.toThrow(
        /STATE/i,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
