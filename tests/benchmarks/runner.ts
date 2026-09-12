import { mkdtempSync, rmSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import { EpistemicGateEngine } from "../../src/gates/gate-engine.js";
import { runMigrate } from "../../src/cli/commands/migrate.js";
import { CAPACITY_LIMITS } from "../../src/graph/capacity.js";
import {
  BENCHMARK_THRESHOLDS,
  generateBenchmarkGraph,
  populateBenchmarkStorage,
  type BenchmarkDataset,
  type BenchmarkCapacities,
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
  details?: Record<string, number>;
}

export interface RssCheckResult {
  attributableRssBytes: number;
  passed: boolean;
  valid: boolean;
}

export type RssMeasurementSource = "process.resourceUsage.maxRSS" | "injected";

export interface ConcurrencyEvidence {
  requested: number;
  observed: number;
  budget: number;
  p95Ms: number;
  passed: boolean;
}

export interface BenchmarkReport {
  timestamp: string;
  tier: BenchmarkTier;
  nodeCount: number;
  edgeCount: number;
  eventCount: number;
  seed: number;
  capacities: BenchmarkCapacities;
  observedCapacities: {
    nodes: number;
    edges: number;
    events: number;
    cards: number;
    reports: number;
    processes: number;
  };
  thresholds: typeof BENCHMARK_THRESHOLDS;
  memory: {
    baselineRssBytes: number | null;
    peakRssBytes: number | null;
    attributableRssBytes: number;
    budgetBytes: number;
    peakRssMb: number | null;
    passed: boolean;
    valid: boolean;
    source: RssMeasurementSource;
  };
  concurrency: ConcurrencyEvidence;
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
  rssReader?: () => number | null;
}

/**
 * Reserves room for the warmup and measured node mutations in the ceiling
 * fixture so the benchmark itself never crosses the declared node envelope.
 */
export function getMutationFixtureNodeCount(
  nodeCapacity: number,
  standardIterations: number,
): number {
  if (!Number.isSafeInteger(nodeCapacity) || nodeCapacity < 1) {
    throw new RangeError("nodeCapacity must be a positive safe integer");
  }
  if (!Number.isSafeInteger(standardIterations) || standardIterations < 1) {
    throw new RangeError("standardIterations must be a positive safe integer");
  }

  const reservedNodes = standardIterations + 1;
  const fixtureNodeCount = nodeCapacity - reservedNodes;
  if (fixtureNodeCount < 1) {
    throw new RangeError("nodeCapacity must include room for benchmark mutations");
  }
  return fixtureNodeCount;
}

/**
 * Computes attributable RSS without allowing invalid measurements to pass as
 * a zero-byte delta. The benchmark intentionally fails closed when either
 * sample is unavailable or non-finite.
 */
export function calculateAttributableRss(
  baselineRssBytes: number | null | undefined,
  peakRssBytes: number | null | undefined,
  budgetBytes = BENCHMARK_THRESHOLDS.rssBytes,
): RssCheckResult {
  if (
    baselineRssBytes === null ||
    baselineRssBytes === undefined ||
    peakRssBytes === null ||
    peakRssBytes === undefined ||
    !Number.isFinite(baselineRssBytes) ||
    !Number.isFinite(peakRssBytes) ||
    baselineRssBytes < 0 ||
    peakRssBytes < 0
  ) {
    return { attributableRssBytes: 0, passed: false, valid: false };
  }

  // A kernel-backed high-water sample cannot fall below its baseline. Treat a
  // decreasing injected sample as invalid instead of turning it into a zero
  // delta that could pass the memory gate.
  if (peakRssBytes < baselineRssBytes) {
    return { attributableRssBytes: 0, passed: false, valid: false };
  }

  const attributableRssBytes = Math.max(0, peakRssBytes - baselineRssBytes);
  return {
    attributableRssBytes,
    passed: attributableRssBytes <= budgetBytes,
    valid: true,
  };
}

function readRssBytes(reader: () => number | null): number | null {
  try {
    const value = reader();
    return value !== null && Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * Reads the kernel-backed high-water RSS for the current Node process.
 * Node exposes maxRSS in kibibytes, while benchmark reports use bytes.
 */
export function readHighWaterRssBytes(): number | null {
  try {
    const maxRssKib = process.resourceUsage().maxRSS;
    if (!Number.isFinite(maxRssKib) || maxRssKib <= 0) return null;
    const maxRssBytes = maxRssKib * 1024;
    return Number.isSafeInteger(maxRssBytes) ? maxRssBytes : null;
  } catch {
    return null;
  }
}

async function measureLatency(
  fn: () => Promise<void> | void,
  iterations: number,
): Promise<number[]> {
  if (!Number.isSafeInteger(iterations) || iterations < 1) {
    throw new RangeError("iterations must be a positive safe integer");
  }
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

interface ConcurrentMeasurement {
  durationMs: number;
  peakConcurrency: number;
}

async function measureConcurrentMaterialization(
  storageDir: string,
  processCount: number,
  iterations: number,
): Promise<{ samples: number[]; peakConcurrency: number }> {
  const workerPath = join(process.cwd(), "scripts", "benchmark-concurrency-worker.mjs");
  const runWorker = (mode: "reader" | "writer"): Promise<void> =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx/esm", workerPath, storageDir, mode], {
        cwd: process.cwd(),
        stdio: "ignore",
        shell: false,
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`Benchmark worker exited with ${signal ?? `code ${code}`}`));
      });
    });

  const run = async (): Promise<ConcurrentMeasurement> => {
    const start = performance.now();
    await Promise.all([runWorker("writer"), ...Array.from({ length: processCount - 1 }, () => runWorker("reader"))]);
    return { durationMs: performance.now() - start, peakConcurrency: processCount };
  };

  await run();
  const samples: number[] = [];
  let peakConcurrency = 0;
  for (let i = 0; i < iterations; i += 1) {
    const measurement = await run();
    samples.push(measurement.durationMs);
    peakConcurrency = Math.max(peakConcurrency, measurement.peakConcurrency);
  }
  return { samples, peakConcurrency };
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
  const fastIterations = options.fastIterations ?? (tier === "ceiling" ? 20 : 10);
  const standardIterations = options.standardIterations ?? (tier === "ceiling" ? 10 : 5);
  const batchIterations = options.batchIterations ?? (tier === "ceiling" ? 5 : 1);

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
    await populateBenchmarkStorage(storageDir, dataset);

    const metrics: Record<string, MetricResult> = {};

    // 3. Memory Measurement Baseline
    const rssReader = options.rssReader ?? readHighWaterRssBytes;
    const rssSource: RssMeasurementSource = options.rssReader
      ? "injected"
      : "process.resourceUsage.maxRSS";
    const baselineSample = readRssBytes(rssReader);
    const baselineRssBytes = baselineSample;

    // 4. Materialize in-memory graph for Fast tier
    const coldGraph = EpistemicGraph.open(storageDir);
    const materialized = await coldGraph.materialize();
    const inMemGraph = EpistemicGraph.inMemory(materialized);

    // --- Fast Tier (< 100 ms) ---
    const sampleNodeId = dataset.nodes[Math.floor(dataset.nodes.length / 2)].id;

    const getNodeSamples = await measureLatency(async () => {
      await inMemGraph.getNode(sampleNodeId);
    }, fastIterations);
    const getNodeP = computePercentiles(getNodeSamples);
    metrics.getNode = {
      operation: "getNode",
      tier: "fast",
      budgetMs: BENCHMARK_THRESHOLDS.fastMs,
      percentiles: getNodeP,
      passed: getNodeP.p95 < BENCHMARK_THRESHOLDS.fastMs,
    };

    const listNodesSamples = await measureLatency(async () => {
      await inMemGraph.listNodes();
    }, fastIterations);
    const listNodesP = computePercentiles(listNodesSamples);
    metrics.listNodes = {
      operation: "listNodes",
      tier: "fast",
      budgetMs: BENCHMARK_THRESHOLDS.fastMs,
      percentiles: listNodesP,
      passed: listNodesP.p95 < BENCHMARK_THRESHOLDS.fastMs,
    };

    const listEdgesSamples = await measureLatency(async () => {
      await inMemGraph.listEdges();
    }, fastIterations);
    const listEdgesP = computePercentiles(listEdgesSamples);
    metrics.listEdges = {
      operation: "listEdges",
      tier: "fast",
      budgetMs: BENCHMARK_THRESHOLDS.fastMs,
      percentiles: listEdgesP,
      passed: listEdgesP.p95 < BENCHMARK_THRESHOLDS.fastMs,
    };

    const getFrontierSamples = await measureLatency(async () => {
      await inMemGraph.getFrontier();
    }, fastIterations);
    const getFrontierP = computePercentiles(getFrontierSamples);
    metrics.getFrontier = {
      operation: "getFrontier",
      tier: "fast",
      budgetMs: BENCHMARK_THRESHOLDS.fastMs,
      percentiles: getFrontierP,
      passed: getFrontierP.p95 < BENCHMARK_THRESHOLDS.fastMs,
    };

    const getOpenUnknownsSamples = await measureLatency(async () => {
      await inMemGraph.getOpenUnknowns();
    }, fastIterations);
    const getOpenUnknownsP = computePercentiles(getOpenUnknownsSamples);
    metrics.getOpenUnknowns = {
      operation: "getOpenUnknowns",
      tier: "fast",
      budgetMs: BENCHMARK_THRESHOLDS.fastMs,
      percentiles: getOpenUnknownsP,
      passed: getOpenUnknownsP.p95 < BENCHMARK_THRESHOLDS.fastMs,
    };

    // --- Standard Tier (< 1.5 s = 1500 ms) ---
    const openSamples = await measureLatency(async () => {
      const g = EpistemicGraph.open(storageDir!);
      await g.materialize();
    }, standardIterations);
    const openP = computePercentiles(openSamples);
    metrics.open = {
      operation: "open",
      tier: "standard",
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: openP,
      passed: openP.p95 < BENCHMARK_THRESHOLDS.standardMs,
    };

    const sliceNodesCount =
      tier === "ceiling"
        ? getMutationFixtureNodeCount(dataset.capacities.nodes, standardIterations)
        : dataset.nodes.length;
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
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: addNodeP,
      passed: addNodeP.p95 < BENCHMARK_THRESHOLDS.standardMs,
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
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: updateNodeP,
      passed: updateNodeP.p95 < BENCHMARK_THRESHOLDS.standardMs,
    };

    let addEdgeCounter = 0;
    const addEdgeSamples = await measureLatency(async () => {
      addEdgeCounter += 1;
      await mutationGraph.addEdge(
        `TASK-bench-add-${addNodeCounter}`,
        "references",
        mutationNodes[addEdgeCounter % mutationNodes.length].id,
      );
    }, standardIterations);
    const addEdgeP = computePercentiles(addEdgeSamples);
    metrics.addEdge = {
      operation: "addEdge",
      tier: "standard",
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: addEdgeP,
      passed: addEdgeP.p95 < BENCHMARK_THRESHOLDS.standardMs,
    };

    const gateSamples = await measureLatency(async () => {
      await EpistemicGateEngine.verify(materialized, { gate: "structural" });
    }, standardIterations);
    const gateP = computePercentiles(gateSamples);
    metrics.gate = {
      operation: "gate",
      tier: "standard",
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: gateP,
      passed: gateP.p95 < BENCHMARK_THRESHOLDS.standardMs,
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
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: verifyP,
      passed: verifyP.p95 < BENCHMARK_THRESHOLDS.standardMs,
    };

    // --- Batch Tier (< 10 s = 10000 ms) ---
    let renderedReport = "";
    const reportSamples = await measureLatency(async () => {
      renderedReport = (await coldGraph.report()).text;
    }, batchIterations);
    const reportP = computePercentiles(reportSamples);
    metrics.report = {
      operation: "report",
      tier: "batch",
      budgetMs: BENCHMARK_THRESHOLDS.batchMs,
      percentiles: reportP,
      passed: reportP.p95 < BENCHMARK_THRESHOLDS.batchMs,
    };

    const rebuildSamples = await measureLatency(async () => {
      await coldGraph.regenerateIndex();
    }, batchIterations);
    const rebuildP = computePercentiles(rebuildSamples);
    metrics.projectionRebuild = {
      operation: "projectionRebuild",
      tier: "batch",
      budgetMs: BENCHMARK_THRESHOLDS.batchMs,
      percentiles: rebuildP,
      passed: rebuildP.p95 < BENCHMARK_THRESHOLDS.batchMs,
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
      budgetMs: BENCHMARK_THRESHOLDS.batchMs,
      percentiles: migrationP,
      passed: migrationP.p95 < BENCHMARK_THRESHOLDS.batchMs,
    };

    const concurrencyMeasurement = await measureConcurrentMaterialization(
      storageDir,
      dataset.capacities.processes,
      standardIterations,
    );
    const concurrencyP = computePercentiles(concurrencyMeasurement.samples);
    const concurrency = {
      requested: dataset.capacities.processes,
      observed: concurrencyMeasurement.peakConcurrency,
      budget: BENCHMARK_THRESHOLDS.maxConcurrentProcesses,
      p95Ms: concurrencyP.p95,
      passed: concurrencyMeasurement.peakConcurrency <= BENCHMARK_THRESHOLDS.maxConcurrentProcesses,
    } satisfies ConcurrencyEvidence;
    metrics.concurrency = {
      operation: "concurrentMaterialize",
      tier: "standard",
      budgetMs: BENCHMARK_THRESHOLDS.standardMs,
      percentiles: concurrencyP,
      passed: concurrency.passed,
      details: {
        requestedProcesses: concurrency.requested,
        observedProcesses: concurrency.observed,
        processBudget: concurrency.budget,
      },
    };

    const reportsDirectory = join(storageDir, "reports");
    await mkdir(reportsDirectory, { recursive: true });
    for (let i = 1; i <= dataset.capacities.reports; i += 1) {
      await writeFile(
        join(reportsDirectory, `benchmark-${String(i).padStart(3, "0")}.md`),
        renderedReport,
        "utf8",
      );
    }

    const cardEntries = await readdir(join(storageDir, "cards"), {
      withFileTypes: true,
    });
    const cardCount = cardEntries.filter(
      (entry) => entry.isFile() && entry.name.endsWith(".md"),
    ).length;
    const persistedGraph = materialized;
    const journal = await readFile(join(storageDir, "GRAPH.jsonl"), "utf8");
    const observedCapacities = {
      nodes: persistedGraph.nodes.length,
      edges: persistedGraph.edges.length,
      events: journal.split("\n").filter((line) => line.trim().length > 0).length,
      cards: cardCount,
      reports: (await readdir(reportsDirectory)).filter((name) => name.endsWith(".md")).length,
      processes: concurrency.observed,
    };
    const capacityChecksPassed =
      observedCapacities.nodes === dataset.capacities.nodes &&
      observedCapacities.edges === dataset.capacities.edges &&
      observedCapacities.events === dataset.capacities.events &&
      observedCapacities.cards === dataset.capacities.cards &&
      observedCapacities.reports === dataset.capacities.reports &&
      observedCapacities.processes === dataset.capacities.processes;

    // Sample after query, batch, report, and concurrency work so the
    // attributable measurement covers the whole benchmark session.
    const peakSample = readRssBytes(rssReader);
    const peakRssBytes = peakSample;
    const rssCheck = calculateAttributableRss(
      baselineSample,
      peakSample,
      CAPACITY_LIMITS.MAX_RSS_BYTES,
    );

    const allPassed =
      rssCheck.passed && capacityChecksPassed && Object.values(metrics).every((m) => m.passed);

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      tier,
      nodeCount: observedCapacities.nodes,
      edgeCount: observedCapacities.edges,
      eventCount: observedCapacities.events,
      seed,
      capacities: dataset.capacities,
      observedCapacities,
      thresholds: BENCHMARK_THRESHOLDS,
      memory: {
        baselineRssBytes,
        peakRssBytes,
        attributableRssBytes: rssCheck.attributableRssBytes,
        budgetBytes: BENCHMARK_THRESHOLDS.rssBytes,
        peakRssMb:
          peakRssBytes === null ? null : Number((peakRssBytes / (1024 * 1024)).toFixed(2)),
        passed: rssCheck.passed,
        valid: rssCheck.valid,
        source: rssSource,
      },
      concurrency,
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
