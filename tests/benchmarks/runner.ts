import { mkdtempSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import { GraphStorage } from "../../src/graph/storage.js";
import { EpistemicGateEngine } from "../../src/gates/gate-engine.js";
import { runMigrate } from "../../src/cli/commands/migrate.js";
import { CAPACITY_LIMITS } from "../../src/graph/capacity.js";
import {
  BENCHMARK_TIERS,
  generateBenchmarkGraph,
  populateBenchmarkStorage,
  type BenchmarkDataset,
  type BenchmarkTier,
} from "./generator.js";

export interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  samples: number;
}

export function computePercentiles(samples: number[]): LatencyPercentiles {
  if (samples.length === 0) {
    return { p50: 0, p95: 0, p99: 0, min: 0, max: 0, mean: 0, samples: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    p50: Number(p50.toFixed(3)),
    p95: Number(p95.toFixed(3)),
    p99: Number(p99.toFixed(3)),
    min: Number(min.toFixed(3)),
    max: Number(max.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    samples: sorted.length,
  };
}

export interface MetricResult {
  operation: string;
  tier: "fast" | "standard" | "batch";
  budgetMs: number;
  percentiles: LatencyPercentiles;
  passed: boolean;
}

export interface BenchmarkReport {
  timestamp: string;
  tier: BenchmarkTier;
  nodeCount: number;
  edgeCount: number;
  eventCount: number;
  seed: number;
  memory: {
    baselineRssBytes: number;
    peakRssBytes: number;
    attributableRssBytes: number;
    budgetBytes: number;
    peakRssMb: number;
    passed: boolean;
  };
  metrics: Record<string, MetricResult>;
  allPassed: boolean;
}

export interface RunBenchmarkOptions {
  tier?: BenchmarkTier;
  seed?: number;
  storageDir?: string;
  outputReportPath?: string;
  fastIterations?: number;
  standardIterations?: number;
  batchIterations?: number;
}

async function measureLatency(
  fn: () => Promise<void> | void,
  iterations: number,
): Promise<number[]> {
  const times: number[] = [];
  // Warmup
  await fn();
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    times.push(duration);
  }
  return times;
}

const nullStream = () =>
  new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });

/**
 * Runs performance benchmarks for the given tier and verifies latency and memory budgets.
 */
export async function runBenchmark(
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkReport> {
  const tier = options.tier ?? "smoke";
  const seed = options.seed ?? 42;
  const fastIterations = options.fastIterations ?? (tier === "ceiling" ? 15 : 10);
  const standardIterations = options.standardIterations ?? (tier === "ceiling" ? 3 : 5);
  const batchIterations = options.batchIterations ?? 1;

  let createdTempDir = false;
  let baseDir: string | undefined;
  let storageDir = options.storageDir;
  if (!storageDir) {
    baseDir = mkdtempSync(join(tmpdir(), `ariadne-bench-${tier}-`));
    storageDir = join(baseDir, ".ariadne");
    createdTempDir = true;
  } else {
    baseDir = join(storageDir, "..");
  }

  try {
    // 1. Generate Dataset
    const dataset = generateBenchmarkGraph(tier, { seed });

    // 2. Populate Storage Directory
    await populateBenchmarkStorage(storageDir, dataset, {
      skipCards: tier === "ceiling",
    });

    const metrics: Record<string, MetricResult> = {};

    // 3. Memory Measurement Baseline
    const baselineRssBytes = process.memoryUsage().rss;

    // 4. Materialize in-memory graph for Fast tier
    const coldGraph = EpistemicGraph.open(storageDir);
    const materialized = await coldGraph.materialize();
    const inMemGraph = EpistemicGraph.inMemory(materialized);

    // Memory Peak after materialization
    const peakRssBytes = process.memoryUsage().rss;
    const attributableRssBytes = Math.max(0, peakRssBytes - baselineRssBytes);
    const memoryPassed = attributableRssBytes <= CAPACITY_LIMITS.MAX_RSS_BYTES;

    // --- Fast Tier (< 100 ms) ---
    const sampleNodeId = dataset.nodes[Math.floor(dataset.nodes.length / 2)].id;

    const getNodeSamples = await measureLatency(async () => {
      await inMemGraph.getNode(sampleNodeId);
    }, fastIterations);
    const getNodeP = computePercentiles(getNodeSamples);
    metrics.getNode = {
      operation: "getNode",
      tier: "fast",
      budgetMs: 100,
      percentiles: getNodeP,
      passed: getNodeP.p95 < 100,
    };

    const listNodesSamples = await measureLatency(async () => {
      await inMemGraph.listNodes();
    }, fastIterations);
    const listNodesP = computePercentiles(listNodesSamples);
    metrics.listNodes = {
      operation: "listNodes",
      tier: "fast",
      budgetMs: 100,
      percentiles: listNodesP,
      passed: listNodesP.p95 < 100,
    };

    const listEdgesSamples = await measureLatency(async () => {
      await inMemGraph.listEdges();
    }, fastIterations);
    const listEdgesP = computePercentiles(listEdgesSamples);
    metrics.listEdges = {
      operation: "listEdges",
      tier: "fast",
      budgetMs: 100,
      percentiles: listEdgesP,
      passed: listEdgesP.p95 < 100,
    };

    const getFrontierSamples = await measureLatency(async () => {
      await inMemGraph.getFrontier();
    }, fastIterations);
    const getFrontierP = computePercentiles(getFrontierSamples);
    metrics.getFrontier = {
      operation: "getFrontier",
      tier: "fast",
      budgetMs: 100,
      percentiles: getFrontierP,
      passed: getFrontierP.p95 < 100,
    };

    const getOpenUnknownsSamples = await measureLatency(async () => {
      await inMemGraph.getOpenUnknowns();
    }, fastIterations);
    const getOpenUnknownsP = computePercentiles(getOpenUnknownsSamples);
    metrics.getOpenUnknowns = {
      operation: "getOpenUnknowns",
      tier: "fast",
      budgetMs: 100,
      percentiles: getOpenUnknownsP,
      passed: getOpenUnknownsP.p95 < 100,
    };

    // --- Standard Tier (< 1 s = 1000 ms) ---
    const openSamples = await measureLatency(async () => {
      const g = EpistemicGraph.open(storageDir!);
      await g.materialize();
    }, standardIterations);
    const openP = computePercentiles(openSamples);
    metrics.open = {
      operation: "open",
      tier: "standard",
      budgetMs: 1000,
      percentiles: openP,
      passed: openP.p95 < 1000,
    };

    const sliceNodesCount = tier === "ceiling" ? 9990 : dataset.nodes.length;
    const mutationNodes = dataset.nodes.slice(0, sliceNodesCount);
    const mutationNodeSet = new Set(mutationNodes.map((n) => n.id));
    const mutationEdges = dataset.edges.filter(
      (e) => mutationNodeSet.has(e.source) && mutationNodeSet.has(e.target),
    );
    const mutationGraph =
      tier === "ceiling"
        ? EpistemicGraph.inMemory({ nodes: mutationNodes, edges: mutationEdges })
        : inMemGraph;

    let addNodeCounter = 0;
    const addNodeSamples = await measureLatency(async () => {
      addNodeCounter += 1;
      await mutationGraph.addNode(
        "TASK",
        `TASK-bench-add-${addNodeCounter}`,
        `Task Bench ${addNodeCounter}`,
        { statement: `Bench statement ${addNodeCounter}` },
      );
    }, standardIterations);
    const addNodeP = computePercentiles(addNodeSamples);
    metrics.addNode = {
      operation: "addNode",
      tier: "standard",
      budgetMs: 1000,
      percentiles: addNodeP,
      passed: addNodeP.p95 < 1000,
    };

    const updateNodeSamples = await measureLatency(async () => {
      await mutationGraph.updateNode(
        `TASK-bench-add-${addNodeCounter}`,
        { title: `Updated Task Bench ${addNodeCounter}` },
      );
    }, standardIterations);
    const updateNodeP = computePercentiles(updateNodeSamples);
    metrics.updateNode = {
      operation: "updateNode",
      tier: "standard",
      budgetMs: 1000,
      percentiles: updateNodeP,
      passed: updateNodeP.p95 < 1000,
    };

    let addEdgeCounter = 0;
    const addEdgeSamples = await measureLatency(async () => {
      addEdgeCounter += 1;
      await mutationGraph.addEdge(
        `TASK-bench-add-${addNodeCounter}`,
        "references",
        dataset.nodes[addEdgeCounter % 9990].id,
      );
    }, standardIterations);
    const addEdgeP = computePercentiles(addEdgeSamples);
    metrics.addEdge = {
      operation: "addEdge",
      tier: "standard",
      budgetMs: 1000,
      percentiles: addEdgeP,
      passed: addEdgeP.p95 < 1000,
    };

    const gateSamples = await measureLatency(async () => {
      await EpistemicGateEngine.verify(materialized, { gate: "structural" });
    }, standardIterations);
    const gateP = computePercentiles(gateSamples);
    metrics.gate = {
      operation: "gate",
      tier: "standard",
      budgetMs: 1000,
      percentiles: gateP,
      passed: gateP.p95 < 1000,
    };

    const verifySamples = await measureLatency(async () => {
      await EpistemicGateEngine.verify(materialized, {
        gate: "all",
      });
    }, standardIterations);
    const verifyP = computePercentiles(verifySamples);
    metrics.verify = {
      operation: "verify",
      tier: "standard",
      budgetMs: 1000,
      percentiles: verifyP,
      passed: verifyP.p95 < 1000,
    };

    // --- Batch Tier (< 10 s = 10000 ms) ---
    const reportSamples = await measureLatency(async () => {
      await coldGraph.report();
    }, batchIterations);
    const reportP = computePercentiles(reportSamples);
    metrics.report = {
      operation: "report",
      tier: "batch",
      budgetMs: 10000,
      percentiles: reportP,
      passed: reportP.p95 < 10000,
    };

    const storage = new GraphStorage(storageDir);
    const rebuildSamples = await measureLatency(async () => {
      await storage.regenerateIndex();
    }, batchIterations);
    const rebuildP = computePercentiles(rebuildSamples);
    metrics.projectionRebuild = {
      operation: "projectionRebuild",
      tier: "batch",
      budgetMs: 10000,
      percentiles: rebuildP,
      passed: rebuildP.p95 < 10000,
    };

    const migrationSamples = await measureLatency(async () => {
      await runMigrate(["--dry-run", "--json"], {
        cwd: baseDir!,
        stdout: nullStream(),
        stderr: nullStream(),
      });
    }, batchIterations);
    const migrationP = computePercentiles(migrationSamples);
    metrics.migrationDryRun = {
      operation: "migrationDryRun",
      tier: "batch",
      budgetMs: 10000,
      percentiles: migrationP,
      passed: migrationP.p95 < 10000,
    };

    const allPassed =
      memoryPassed && Object.values(metrics).every((m) => m.passed);

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      tier,
      nodeCount: dataset.nodes.length,
      edgeCount: dataset.edges.length,
      eventCount: dataset.events.length,
      seed,
      memory: {
        baselineRssBytes,
        peakRssBytes,
        attributableRssBytes,
        budgetBytes: CAPACITY_LIMITS.MAX_RSS_BYTES,
        peakRssMb: Number((peakRssBytes / (1024 * 1024)).toFixed(2)),
        passed: memoryPassed,
      },
      metrics,
      allPassed,
    };

    if (options.outputReportPath) {
      await writeFile(
        options.outputReportPath,
        JSON.stringify(report, null, 2) + "\n",
        "utf8",
      );
    }

    return report;
  } finally {
    if (createdTempDir && baseDir) {
      try {
        rmSync(baseDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }
}
