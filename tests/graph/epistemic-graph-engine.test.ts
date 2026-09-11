import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";

const node = (id: string) => ({
  id,
  type: "TASK" as const,
  provenance_type: "FACT" as const,
  statement: `Node ${id}`,
});

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withTempRoot = async <T>(run: (root: string) => Promise<T>): Promise<T> => {
  const root = await mkdtemp(join(tmpdir(), "ariadne-engine-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe("EpistemicGraph engine surface", () => {
  it("reads canonical events through the engine handle", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();

      await graph.addNode("ASM", "ASM-1", "Check capacity", {
        provenance_type: "ASSUMED",
        statement: "The service can meet the target capacity",
      });

      const events = await graph.readEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ kind: "node", node: { id: "ASM-1" } });
    });
  });

  it("regenerates index and card projections on demand", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await graph.addNode("ASM", "ASM-1", "Check capacity", {
        provenance_type: "ASSUMED",
        statement: "The service can meet the target capacity",
      });

      await writeFile(join(root, "INDEX.md"), "stale index\n", "utf8");
      await writeFile(join(root, "cards", "ASM-1.md"), "stale card\n", "utf8");

      await graph.regenerateIndex();

      expect(await readFile(join(root, "INDEX.md"), "utf8")).toContain("ASM-1");
      expect(await readFile(join(root, "cards", "ASM-1.md"), "utf8")).toContain(
        "Check capacity",
      );
    });
  });

  it("commits multiple queued events atomically through a batch", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();

      const observedAtStart = await graph.batch((batch) => {
        batch.appendEvents([
          { kind: "node", node: node("TASK-001") },
          { kind: "node", node: node("TASK-002") },
          {
            kind: "edge",
            edge: { source: "TASK-002", type: "depends_on", target: "TASK-001" },
          },
        ]);
        batch.regenerateIndex();
        return batch.graph.nodes.length;
      });

      expect(observedAtStart).toBe(0);
      expect(await graph.readEvents()).toHaveLength(3);
      expect((await graph.listNodes()).map(({ id }) => id)).toEqual([
        "TASK-001",
        "TASK-002",
      ]);
      expect(await readFile(join(root, "INDEX.md"), "utf8")).toContain("TASK-002");
    });
  });

  it("leaves no partial state behind when a batch operation throws", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await graph.addNode("TASK", "TASK-000", "Seed node", {
        provenance_type: "FACT",
        statement: "Seed node",
      });
      const seedEvents = await graph.readEvents();

      await expect(
        graph.batch((batch) => {
          batch.appendEvents([{ kind: "node", node: node("TASK-001") }]);
          batch.appendEvents([
            {
              kind: "edge",
              edge: { source: "TASK-001", type: "depends_on", target: "TASK-000" },
            },
          ]);
          batch.regenerateIndex();
          batch.writeStateProjection('{"frontier":["TASK-001"]}\n');
          batch.deleteCard("TASK-000");
          throw new Error("batch failed");
        }),
      ).rejects.toThrow("batch failed");

      expect(await graph.readEvents()).toEqual(seedEvents);
      expect(await graph.getNode("TASK-001")).toBeUndefined();

      const index = await readFile(join(root, "INDEX.md"), "utf8");
      expect(index).toContain("TASK-000");
      expect(index).not.toContain("TASK-001");

      expect(await readFile(join(root, "cards", "TASK-000.md"), "utf8")).toContain(
        "TASK-000",
      );

      const state = await readFile(join(root, "STATE.yaml"), "utf8");
      expect(state).not.toContain("TASK-001");
    });
  });

  it("rejects a batch whose queued events do not form a valid graph", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();

      await expect(
        graph.batch((batch) => {
          batch.appendEvents([
            {
              kind: "edge",
              edge: { source: "TASK-001", type: "depends_on", target: "TASK-002" },
            },
          ]);
        }),
      ).rejects.toThrow(/missing node/i);

      expect(await graph.readEvents()).toEqual([]);
    });
  });

  it("serializes concurrent batch writers across engine handles", async () => {
    await withTempRoot(async (root) => {
      const first = EpistemicGraph.open(root);
      await first.init();
      const second = EpistemicGraph.open(root);

      const results = await Promise.all([
        first.batch(async (batch) => {
          expect(batch.graph.nodes).toHaveLength(0);
          await delay(25);
          batch.appendEvents([{ kind: "node", node: node("TASK-001") }]);
          return "first";
        }),
        second.batch((batch) => {
          batch.appendEvents([{ kind: "node", node: node("TASK-002") }]);
          return batch.graph.nodes.map(({ id }) => id);
        }),
      ]);

      expect(results).toEqual(["first", ["TASK-001"]]);
      expect((await second.readEvents()).map((event) => event.kind)).toEqual([
        "node",
        "node",
      ]);
    });
  });

  it("serializes many concurrent batch appends without losing events", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();

      await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          graph.batch((batch) => {
            batch.appendEvents([
              { kind: "node", node: node(`TASK-${String(index).padStart(3, "0")}`) },
            ]);
          }),
        ),
      );

      expect(await graph.readEvents()).toHaveLength(10);
      expect((await graph.listNodes()).map(({ id }) => id)).toEqual(
        Array.from({ length: 10 }, (_, index) =>
          `TASK-${String(index).padStart(3, "0")}`,
        ),
      );
    });
  });

  it("keeps batches atomic for in-memory handles", async () => {
    const graph = EpistemicGraph.inMemory();

    await expect(
      graph.batch((batch) => {
        batch.appendEvents([{ kind: "node", node: node("TASK-001") }]);
        throw new Error("batch failed");
      }),
    ).rejects.toThrow("batch failed");

    expect(await graph.readEvents()).toEqual([]);
    expect(await graph.listNodes()).toEqual([]);
  });
});
