import { mkdtemp, readFile, rm } from "node:fs/promises";
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
        frontier: ["TASK-001"],
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
});
