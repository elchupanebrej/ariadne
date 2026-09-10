import { describe, expect, it } from "vitest";
import { BENCHMARK_THRESHOLDS, BENCHMARK_TIERS } from "./generator.js";
import {
  AUTHORITATIVE_NODE_VERSIONS,
  CEILING_CORPUS,
  REQUIRED_BENCHMARK_METRICS,
  createEvidenceResult,
  createFailedEvidenceResult,
  isAuthoritativeCeilingRuntime,
  summarizeBenchmarkCorpus,
  type BenchmarkRuntime,
} from "./corpus.js";
import type { BenchmarkReport, MetricResult } from "./runner.js";

const runtime: BenchmarkRuntime = {
  nodeVersion: "v24.17.0",
  nodeMajor: 24,
  platform: "linux",
  arch: "x64",
};

function metric(name: string, tier: MetricResult["tier"], samples: number): MetricResult {
  return {
    operation: name,
    tier,
    budgetMs:
      tier === "fast"
        ? BENCHMARK_THRESHOLDS.fastMs
        : tier === "standard"
          ? BENCHMARK_THRESHOLDS.standardMs
          : BENCHMARK_THRESHOLDS.batchMs,
    percentiles: { p50: 1, p95: 2, p99: 3, min: 1, max: 3, mean: 2, samples },
    passed: true,
  };
}

function report(): BenchmarkReport {
  const metrics: Record<string, MetricResult> = {};
  for (const name of REQUIRED_BENCHMARK_METRICS) {
    const tier = name === "getNode" || name === "listNodes" || name === "listEdges" || name === "getFrontier" || name === "getOpenUnknowns"
      ? "fast"
      : name === "report" || name === "projectionRebuild" || name === "migrationDryRun"
        ? "batch"
        : "standard";
    metrics[name] = metric(name, tier, tier === "fast" ? 20 : tier === "batch" ? 5 : 10);
  }
  return {
    timestamp: new Date(0).toISOString(),
    tier: "ceiling",
    nodeCount: 10_000,
    edgeCount: 25_000,
    eventCount: 50_000,
    seed: 42,
    capacities: BENCHMARK_TIERS.ceiling,
    observedCapacities: BENCHMARK_TIERS.ceiling,
    thresholds: BENCHMARK_THRESHOLDS,
    memory: {
      baselineRssBytes: 100,
      peakRssBytes: 200,
      attributableRssBytes: 100,
      budgetBytes: BENCHMARK_THRESHOLDS.rssBytes,
      peakRssMb: 0,
      passed: true,
      valid: true,
      source: "injected",
    },
    concurrency: { requested: 2, observed: 2, budget: 2, p95Ms: 2, passed: true },
    metrics,
    allPassed: true,
  };
}

describe("authoritative benchmark corpus", () => {
  it("accepts only pinned Linux x64 Node runtimes for authoritative evidence", () => {
    expect(AUTHORITATIVE_NODE_VERSIONS).toEqual(["v22.23.0", "v24.17.0"]);
    expect(isAuthoritativeCeilingRuntime(runtime)).toBe(true);
    expect(isAuthoritativeCeilingRuntime({ ...runtime, nodeVersion: "v26.3.1", nodeMajor: 26 })).toBe(false);
    expect(isAuthoritativeCeilingRuntime({ ...runtime, platform: "win32" })).toBe(false);
    expect(isAuthoritativeCeilingRuntime({ ...runtime, arch: "arm64" })).toBe(false);
  });

  it("summarizes five complete ceiling Evidence Results by worst observed values", () => {
    const results = Array.from({ length: CEILING_CORPUS.runs }, (_, index) =>
      createEvidenceResult(report(), index + 1, runtime),
    );
    const summary = summarizeBenchmarkCorpus(results, ["run-1.json"]);

    expect(summary.passed).toBe(true);
    expect(summary.completedRuns).toBe(5);
    expect(summary.samples).toEqual(CEILING_CORPUS);
    expect(summary.worst.metrics.open.p95).toBe(2);
    expect(summary.worst.memory.attributableRssBytes).toBe(100);
  });

  it("fails closed when one run is incomplete", () => {
    const results = [
      ...Array.from({ length: 4 }, (_, index) => createEvidenceResult(report(), index + 1, runtime)),
      createFailedEvidenceResult(5, runtime, "worker timed out"),
    ];
    const summary = summarizeBenchmarkCorpus(results);

    expect(summary.passed).toBe(false);
    expect(summary.completedRuns).toBe(4);
    expect(summary.failures).toContain("run 5: benchmark process did not return a complete report");
    expect(summary.worst.memory.valid).toBe(false);
  });

  it("keeps an invalid RSS measurement from becoming a passing zero delta", () => {
    const invalid = report();
    invalid.memory.valid = false;
    invalid.memory.passed = false;
    const results = Array.from({ length: 5 }, (_, index) =>
      createEvidenceResult(invalid, index + 1, runtime),
    );
    const summary = summarizeBenchmarkCorpus(results);

    expect(summary.passed).toBe(false);
    expect(summary.worst.memory.passed).toBe(false);
  });

  it("gates concurrency by process count while retaining latency as evidence", () => {
    const measured = report();
    measured.concurrency.p95Ms = BENCHMARK_THRESHOLDS.standardMs + 100;
    measured.metrics.concurrency.percentiles.p95 = measured.concurrency.p95Ms;
    const results = Array.from({ length: CEILING_CORPUS.runs }, (_, index) =>
      createEvidenceResult(measured, index + 1, runtime),
    );

    const summary = summarizeBenchmarkCorpus(results);

    expect(summary.passed).toBe(true);
    expect(summary.worst.concurrency.observed).toBe(2);
    expect(summary.worst.concurrency.p95Ms).toBe(BENCHMARK_THRESHOLDS.standardMs + 100);
  });

  it("fails closed when evidence mixes authoritative runtimes", () => {
    const results = Array.from({ length: CEILING_CORPUS.runs }, (_, index) =>
      createEvidenceResult(report(), index + 1, index === 0 ? runtime : { ...runtime, nodeVersion: "v22.23.0", nodeMajor: 22 }),
    );

    const summary = summarizeBenchmarkCorpus(results);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContain("corpus must use one authoritative runtime");
  });

  it("fails closed when evidence declares a different release baseline", () => {
    const invalid = createEvidenceResult(report(), 1, runtime);
    invalid.thresholds = { ...invalid.thresholds, rssBytes: invalid.thresholds.rssBytes - 1 };
    const results = [
      invalid,
      ...Array.from({ length: CEILING_CORPUS.runs - 1 }, (_, index) =>
        createEvidenceResult(report(), index + 2, runtime),
      ),
    ];

    const summary = summarizeBenchmarkCorpus(results);

    expect(summary.passed).toBe(false);
    expect(summary.failures).toContain("run 1: thresholds do not match the approved release baseline");
  });
});
