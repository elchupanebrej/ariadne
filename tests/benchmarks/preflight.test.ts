import { describe, expect, it } from "vitest";
import { BENCHMARK_THRESHOLDS } from "./generator.js";
import {
  buildConservativeThresholds,
  evaluateLocalPreflight,
  type LocalPreflightRun,
} from "./preflight.js";
import type { BenchmarkReport } from "./runner.js";

function report(p95Ms: number, attributableRssBytes = 100): BenchmarkReport {
  return {
    timestamp: new Date(0).toISOString(),
    tier: "ceiling",
    nodeCount: 10_000,
    edgeCount: 25_000,
    eventCount: 50_000,
    seed: 42,
    capacities: {
      nodes: 10_000,
      edges: 25_000,
      events: 50_000,
      cards: 10_000,
      reports: 50,
      processes: 2,
    },
    observedCapacities: {
      nodes: 10_000,
      edges: 25_000,
      events: 50_000,
      cards: 10_000,
      reports: 50,
      processes: 2,
    },
    thresholds: BENCHMARK_THRESHOLDS,
    memory: {
      baselineRssBytes: 100,
      peakRssBytes: 100 + attributableRssBytes,
      attributableRssBytes,
      budgetBytes: BENCHMARK_THRESHOLDS.rssBytes,
      peakRssMb: 0,
      passed: true,
      valid: true,
      source: "injected",
    },
    concurrency: {
      requested: 2,
      observed: 2,
      budget: 2,
      p95Ms,
      passed: true,
    },
    metrics: {
      open: {
        operation: "open",
        tier: "standard",
        budgetMs: BENCHMARK_THRESHOLDS.standardMs,
        percentiles: {
          p50: p95Ms,
          p95: p95Ms,
          p99: p95Ms,
          min: p95Ms,
          max: p95Ms,
          mean: p95Ms,
          samples: 10,
        },
        passed: p95Ms < BENCHMARK_THRESHOLDS.standardMs,
      },
    },
    allPassed: p95Ms < BENCHMARK_THRESHOLDS.standardMs,
  };
}

function runsFromReports(reports: BenchmarkReport[]): LocalPreflightRun[] {
  return reports.map((runReport, index) => ({ run: index + 1, report: runReport }));
}

describe("local preflight", () => {
  it("builds conservative budgets from the release thresholds", () => {
    expect(buildConservativeThresholds(0.75)).toEqual({
      fastMs: 75,
      standardMs: 1125,
      batchMs: 7_500,
      rssBytes: Math.floor(BENCHMARK_THRESHOLDS.rssBytes * 0.75),
    });
  });

  it("returns likely-pass only when every run clears the conservative budgets", () => {
    const result = evaluateLocalPreflight(
      runsFromReports(Array.from({ length: 5 }, () => report(700, 100))),
    );
    expect(result.localContractPassed).toBe(true);
    expect(result.ciPreflightPassed).toBe(true);
    expect(result.verdict).toBe("likely-pass");
  });

  it("returns uncertain when the release gate passes without conservative headroom", () => {
    const result = evaluateLocalPreflight(
      runsFromReports(Array.from({ length: 5 }, () => report(1200, 100))),
    );
    expect(result.localContractPassed).toBe(true);
    expect(result.ciPreflightPassed).toBe(false);
    expect(result.verdict).toBe("uncertain");
  });

  it("fails closed when a run is missing", () => {
    const result = evaluateLocalPreflight(runsFromReports([report(700, 100)]));
    expect(result.localContractPassed).toBe(false);
    expect(result.verdict).toBe("likely-fail");
    expect(result.completedRuns).toBe(1);
  });
});
