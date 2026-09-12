import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GraphEvent } from "../../src/graph/domain.js";
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

  it("rejects malformed workspace state read through the engine handle", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await writeFile(join(root, "STATE.yaml"), '{"frontier":"not-an-array"}\n', "utf8");

      await expect(graph.getState()).rejects.toThrow(/Invalid STATE\.yaml/);
    });
  });

  it("strips schema_version from state read through the engine handle", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await writeFile(
        join(root, "STATE.yaml"),
        '{"schema_version":1,"depth_mode":"Deep"}\n',
        "utf8",
      );

      const state = (await graph.getState()) as Record<string, unknown>;
      expect(state).toEqual({ depth_mode: "Deep" });
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

      await writeFile(join(root, "cards", "ASM-1.md"), "stale card\n", "utf8");

      await graph.regenerateIndex();

      expect(await graph.renderIndex()).toContain("ASM-1");
      const card = await graph.batch((batch) => batch.readCard("ASM-1"));
      expect(card).toContain("Check capacity");
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
      expect(await graph.renderIndex()).toContain("TASK-002");
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

      const index = await graph.renderIndex();
      expect(index).toContain("TASK-000");
      expect(index).not.toContain("TASK-001");

      const card = await graph.batch((batch) => batch.readCard("TASK-000"));
      expect(card).toContain("TASK-000");

      const state = (await graph.getState()) as Record<string, unknown>;
      expect(state.frontier).toEqual(["TASK-000"]);
      expect(JSON.stringify(state)).not.toContain("TASK-001");
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

  it("applies queued events and projection operations from a successful batch", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await graph.addNode("TASK", "TASK-000", "Seed node", {
        provenance_type: "FACT",
        statement: "Seed node",
      });

      await graph.batch((batch) => {
        batch.appendEvents([{ kind: "node", node: node("TASK-001") }]);
        batch.writeCards([{ id: "TASK-001", content: "custom card body\n" }]);
        batch.deleteCard("TASK-000");
        batch.writeStateProjection('{"frontier":["TASK-001"]}\n');
      });

      expect(await graph.readEvents()).toHaveLength(2);

      const state = (await graph.getState()) as Record<string, unknown>;
      expect(state.frontier).toEqual(["TASK-001"]);

      const projections = await graph.batch(async (batch) => ({
        card: await batch.readCard("TASK-001"),
        removed: await batch.readCard("TASK-000"),
        ids: await batch.listCards(),
        state: await batch.readState(),
      }));
      expect(projections.card).toBe("custom card body\n");
      expect(projections.removed).toBeUndefined();
      expect(projections.ids).toEqual(["TASK-001"]);
      expect(projections.state).toEqual({ frontier: ["TASK-001"] });
    });
  });

  it("commits no events when a batch contains an invalid event", async () => {
    await withTempRoot(async (root) => {
      const graph = EpistemicGraph.open(root);
      await graph.init();
      await graph.addNode("TASK", "TASK-000", "Seed node", {
        provenance_type: "FACT",
        statement: "Seed node",
      });
      const seedEvents = await graph.readEvents();
      const seedState = await graph.getState();

      await expect(
        graph.batch((batch) => {
          batch.appendEvents([
            { kind: "node", node: node("TASK-001") },
            { kind: "node", node: { id: "TASK-002" } } as unknown as GraphEvent,
          ]);
        }),
      ).rejects.toThrow();

      expect(await graph.readEvents()).toEqual(seedEvents);
      expect(await graph.getState()).toEqual(seedState);
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

describe("EpistemicGraph persistence and validation parity", () => {
  it("appends a validated batch and regenerates the index once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-batch-"));

    try {
      const graph = EpistemicGraph.open(directory);
      await graph.batch((batch) => {
        batch.appendEvents([
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
      });

      expect(await graph.readEvents()).toHaveLength(3);
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
      const graph = EpistemicGraph.open(directory);
      await graph.batch((batch) =>
        batch.writeStateProjection(
          `${JSON.stringify(
            { schema_version: 1, depth_mode: "Standard", frontier: ["TASK-001"] },
            null,
            2,
          )}\n`,
        ),
      );
      await graph.batch((batch) => {
        batch.appendEvents([
          { kind: "node", node: node("TASK-001") },
          { kind: "node", node: node("TASK-002") },
          {
            kind: "edge",
            edge: { source: "TASK-002", type: "depends_on", target: "TASK-001" },
          },
        ]);
      });

      const restarted = EpistemicGraph.open(directory);
      expect(await restarted.getState()).toEqual({
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
      const graph = EpistemicGraph.open(directory);
      await Promise.all(
        Array.from({ length: 20 }, (_, index) =>
          graph.batch((batch) => {
            batch.appendEvents([
              { kind: "node", node: node(`TASK-${String(index).padStart(3, "0")}`) },
            ]);
          }),
        ),
      );

      const events = await graph.readEvents();
      expect(events).toHaveLength(20);
      expect((await graph.materialize()).nodes.map(({ id }) => id)).toEqual(
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

  it("serializes read-check-append batches across engine handles", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-transaction-"));

    try {
      const first = EpistemicGraph.open(directory);
      const second = EpistemicGraph.open(directory);
      const results = await Promise.all([
        first.batch(async (batch) => {
          expect(batch.graph.nodes).toHaveLength(0);
          await delay(20);
          batch.appendEvents([{ kind: "node", node: node("TASK-001") }]);
          return "first";
        }),
        second.batch((batch) => {
          const ids = batch.graph.nodes.map(({ id }) => id);
          batch.appendEvents([{ kind: "node", node: node("TASK-002") }]);
          return ids;
        }),
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
      const graph = EpistemicGraph.open(directory);

      expect(await graph.materialize()).toEqual({ nodes: [node("TASK-001")], edges: [] });
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
      const graph = EpistemicGraph.open(directory);
      await expect(
        graph.batch((batch) => {
          batch.appendEvents([
            { kind: "edge", edge: { source: "TASK-1", type: "depends_on", target: "TASK-2" } },
          ]);
        }),
      ).rejects.toThrow(/missing node/i);
      expect(await graph.readEvents()).toEqual([]);

      await graph.batch((batch) => {
        batch.appendEvents([
          { kind: "edge", edge: { source: "TASK-1", type: "depends_on", target: "TASK-2" } },
          { kind: "node", node: node("TASK-1") },
          { kind: "node", node: node("TASK-2") },
        ]);
      });
      const beforeCycle = await graph.readEvents();
      await expect(
        graph.batch((batch) => {
          batch.appendEvents([
            {
              kind: "edge",
              edge: { source: "TASK-2", type: "depends_on", target: "TASK-1" },
            },
          ]);
        }),
      ).rejects.toThrow(/cycle/i);
      expect(await graph.readEvents()).toEqual(beforeCycle);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("excludes terminal nodes and decided decisions from state frontier and index", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-terminal-"));

    try {
      const graph = EpistemicGraph.open(directory);
      await graph.batch((batch) =>
        batch.writeStateProjection(
          `${JSON.stringify({ schema_version: 1, depth_mode: "Standard", frontier: [] }, null, 2)}\n`,
        ),
      );
      await graph.batch((batch) => {
        batch.appendEvents([
          {
            kind: "node",
            node: {
              id: "TASK-open",
              type: "TASK" as const,
              provenance_type: "FACT" as const,
              statement: "Open unresolved task",
            },
          },
          {
            kind: "node",
            node: {
              id: "UNK-resolved",
              type: "UNK" as const,
              provenance_type: "UNKNOWN" as const,
              status: "RESOLVED",
              statement: "Resolved unknown",
            },
          },
          {
            kind: "node",
            node: {
              id: "CAN-rejected",
              type: "CAN" as const,
              provenance_type: "PROPOSED" as const,
              status: "REJECTED",
              statement: "Rejected candidate",
            },
          },
          {
            kind: "node",
            node: {
              id: "DEC-decided",
              type: "DEC" as const,
              provenance_type: "DECIDED" as const,
              statement: "Decided decision",
            },
          },
        ]);
      });

      const state = (await graph.getState()) as {
        frontier: string[];
        open_unknowns: string[];
      };
      expect(state.frontier).toEqual(["TASK-open"]);
      expect(state.open_unknowns).toEqual([]);

      const indexContent = await readFile(join(directory, "INDEX.md"), "utf8");
      expect(indexContent).toContain("TASK-open");
      expect(indexContent).not.toContain("UNK-resolved");
      expect(indexContent).not.toContain("CAN-rejected");
      expect(indexContent).not.toContain("DEC-decided");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
