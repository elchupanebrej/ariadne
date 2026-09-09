import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkCapacityLimits,
  checkCompactionAdvisory,
  COMPACTION_FILE_SIZE_BYTES,
  MAX_EDGES,
  MAX_EVENTS,
  MAX_NODES,
} from "../../src/graph/capacity.js";
import { AriadneError } from "../../src/core/errors.js";
import {
  generateBenchmarkGraph,
  BENCHMARK_TIERS,
} from "./generator.js";
import {
  calculateAttributableRss,
  getMutationFixtureNodeCount,
  readHighWaterRssBytes,
} from "./runner.js";

describe("benchmark generator", () => {
  it("produces correct node count for smoke tier", () => {
    const graph = generateBenchmarkGraph("smoke");
    expect(graph.nodes.length).toBe(BENCHMARK_TIERS.smoke.nodes);
  });

  it("produces correct node count for mid tier", () => {
    const graph = generateBenchmarkGraph("mid");
    expect(graph.nodes.length).toBe(BENCHMARK_TIERS.mid.nodes);
  });

  it("produces edge count <= target for smoke tier", () => {
    const graph = generateBenchmarkGraph("smoke");
    // smoke: min(250, valid_edges)
    expect(graph.edges.length).toBeLessThanOrEqual(BENCHMARK_TIERS.smoke.edges);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("produces edge count <= target for mid tier", () => {
    const graph = generateBenchmarkGraph("mid");
    expect(graph.edges.length).toBeLessThanOrEqual(BENCHMARK_TIERS.mid.edges);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("is deterministic: same seed produces same first node id", () => {
    const a = generateBenchmarkGraph("smoke", { seed: 123 });
    const b = generateBenchmarkGraph("smoke", { seed: 123 });
    expect(a.nodes[0].id).toBe(b.nodes[0].id);
  });

  it("is deterministic: same seed produces same edge count", () => {
    const a = generateBenchmarkGraph("smoke", { seed: 456 });
    const b = generateBenchmarkGraph("smoke", { seed: 456 });
    expect(a.edges.length).toBe(b.edges.length);
    if (a.edges.length > 0 && b.edges.length > 0) {
      expect(a.edges[0].source).toBe(b.edges[0].source);
    }
  });

  it("generates all events including revision events for smoke tier", () => {
    const graph = generateBenchmarkGraph("smoke");
    expect(graph.events.length).toBe(BENCHMARK_TIERS.smoke.events);
  });

  it("records the declared capacity envelope for every tier", () => {
    const graph = generateBenchmarkGraph("ceiling");
    expect(graph.capacities).toEqual({
      nodes: 10_000,
      edges: 25_000,
      events: 50_000,
      cards: 10_000,
      reports: 50,
      processes: 2,
    });
  });
});

describe("calculateAttributableRss", () => {
  it("fails closed when a baseline or peak sample is invalid", () => {
    expect(calculateAttributableRss(Number.NaN, 10)).toEqual({
      attributableRssBytes: 0,
      passed: false,
      valid: false,
    });
    expect(calculateAttributableRss(10, undefined)).toEqual({
      attributableRssBytes: 0,
      passed: false,
      valid: false,
    });
  });

  it("computes a bounded attributable delta from valid samples", () => {
    expect(calculateAttributableRss(100, 150, 100)).toEqual({
      attributableRssBytes: 50,
      passed: true,
      valid: true,
    });
    expect(calculateAttributableRss(150, 100, 0)).toEqual({
      attributableRssBytes: 0,
      passed: false,
      valid: false,
    });
  });
});

describe("ceiling mutation fixture", () => {
  it("reserves the warmup and measured mutations inside the node envelope", () => {
    expect(getMutationFixtureNodeCount(10_000, 10)).toBe(9_989);
  });

  it("rejects a fixture that cannot fit its mutation samples", () => {
    expect(() => getMutationFixtureNodeCount(11, 10)).toThrow(RangeError);
  });
});

describe("readHighWaterRssBytes", () => {
  it("returns a positive byte value for the current Node process", () => {
    expect(readHighWaterRssBytes()).toBeGreaterThan(0);
  });
});

describe("checkCapacityLimits", () => {
  it("does NOT throw when within limits", () => {
    expect(() => checkCapacityLimits({ nodes: 100, edges: 500, events: 1000 })).not.toThrow();
  });

  it("does NOT throw at exact limit boundaries", () => {
    expect(() =>
      checkCapacityLimits({ nodes: MAX_NODES, edges: MAX_EDGES, events: MAX_EVENTS }),
    ).not.toThrow();
  });

  it("throws AriadneError(CAPACITY_EXCEEDED) when nodes > MAX_NODES", () => {
    let thrown: unknown;
    try {
      checkCapacityLimits({ nodes: MAX_NODES + 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AriadneError);
    expect((thrown as AriadneError).code).toBe("CAPACITY_EXCEEDED");
  });

  it("throws AriadneError(CAPACITY_EXCEEDED) when edges > MAX_EDGES", () => {
    let thrown: unknown;
    try {
      checkCapacityLimits({ edges: MAX_EDGES + 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AriadneError);
    expect((thrown as AriadneError).code).toBe("CAPACITY_EXCEEDED");
  });

  it("throws AriadneError(CAPACITY_EXCEEDED) when events > MAX_EVENTS", () => {
    let thrown: unknown;
    try {
      checkCapacityLimits({ events: MAX_EVENTS + 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AriadneError);
    expect((thrown as AriadneError).code).toBe("CAPACITY_EXCEEDED");
  });

  it("checks nodes limit independently of edges and events", () => {
    let thrown: unknown;
    try {
      checkCapacityLimits({ nodes: MAX_NODES + 1, edges: 1, events: 1 });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AriadneError);
    expect((thrown as AriadneError).code).toBe("CAPACITY_EXCEEDED");
  });
});

describe("checkCompactionAdvisory", () => {
  it("returns null for an empty directory (no GRAPH.jsonl)", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "ariadne-cap-test-"));
    try {
      const result = await checkCompactionAdvisory(tmpDir);
      expect(result).toBeNull();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns null for a small GRAPH.jsonl file with recognized entities", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "ariadne-cap-test-"));
    try {
      // 1 event, 1 recognized entity — ratio 1.0 < 3x threshold → no advisory
      const line = JSON.stringify({ kind: "node", node: { id: "TASK-001", type: "TASK" } });
      await writeFile(join(tmpDir, "GRAPH.jsonl"), line + "\n", "utf8");
      const result = await checkCompactionAdvisory(tmpDir);
      expect(result).toBeNull();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns advisory string for a GRAPH.jsonl file > COMPACTION_FILE_SIZE_BYTES", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "ariadne-cap-test-"));
    try {
      // Write a file larger than 10 MB using 64 KB chunks
      const chunkSize = 64 * 1024;
      const totalChunks = Math.ceil((COMPACTION_FILE_SIZE_BYTES + 1) / chunkSize);
      const chunk = Buffer.alloc(chunkSize, 0x20); // spaces
      const graphPath = join(tmpDir, "GRAPH.jsonl");
      await writeFile(graphPath, chunk);
      for (let i = 1; i < totalChunks; i++) {
        await appendFile(graphPath, chunk);
      }
      const result = await checkCompactionAdvisory(tmpDir);
      expect(result).toBeTypeOf("string");
      expect(result).toContain("Advisory");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns advisory string when events exceed 3x entity count", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "ariadne-cap-test-"));
    try {
      // 1 node entity, 4 events (> 3 * 1 = 3 events threshold)
      const lines = [
        JSON.stringify({ kind: "node", node: { id: "TASK-001", type: "TASK" } }),
        JSON.stringify({ kind: "node", node: { id: "TASK-001", type: "TASK" } }),
        JSON.stringify({ kind: "node", node: { id: "TASK-001", type: "TASK" } }),
        JSON.stringify({ kind: "node", node: { id: "TASK-001", type: "TASK" } }),
      ];
      await writeFile(join(tmpDir, "GRAPH.jsonl"), lines.join("\n") + "\n", "utf8");
      const result = await checkCompactionAdvisory(tmpDir);
      expect(result).toBeTypeOf("string");
      expect(result).toContain("Advisory");
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
