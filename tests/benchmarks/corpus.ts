import { BENCHMARK_THRESHOLDS, BENCHMARK_TIERS, type BenchmarkCapacities } from "./generator.js";
import type {
  BenchmarkReport,
  ConcurrencyEvidence,
  MetricResult,
} from "./runner.js";

export const CEILING_CORPUS = {
  runs: 5,
  seed: 42,
  fastIterations: 20,
  standardIterations: 10,
  batchIterations: 5,
} as const;

/**
 * Exact runtimes used by the authoritative ceiling gate. Keeping the patch
 * versions fixed makes Evidence Results comparable across CI runs.
 */
export const AUTHORITATIVE_NODE_VERSIONS = ["v22.23.0", "v24.17.0"] as const;

export const REQUIRED_BENCHMARK_METRICS = [
  "getNode",
  "listNodes",
  "listEdges",
  "getFrontier",
  "getOpenUnknowns",
  "open",
  "addNode",
  "updateNode",
  "addEdge",
  "gate",
  "verify",
  "report",
  "projectionRebuild",
  "migrationDryRun",
  "concurrency",
] as const;

export interface BenchmarkRuntime {
  nodeVersion: string;
  nodeMajor: number;
  platform: string;
  arch: string;
}

export function isAuthoritativeCeilingRuntime(runtime: BenchmarkRuntime): boolean {
  return (
    runtime.platform === "linux" &&
    runtime.arch === "x64" &&
    ((runtime.nodeVersion === AUTHORITATIVE_NODE_VERSIONS[0] && runtime.nodeMajor === 22) ||
      (runtime.nodeVersion === AUTHORITATIVE_NODE_VERSIONS[1] && runtime.nodeMajor === 24))
  );
}

export interface BenchmarkEvidenceResult {
  schemaVersion: 1;
  kind: "capacity-performance-evidence";
  authoritative: true;
  run: number;
  runtime: BenchmarkRuntime;
  tier: "ceiling";
  seed: number;
  samples: {
    fast: number;
    standard: number;
    batch: number;
  };
  thresholds: typeof BENCHMARK_THRESHOLDS;
  capacities: BenchmarkCapacities;
  observedCapacities?: BenchmarkReport["observedCapacities"];
  measurements?: {
    metrics: Record<string, MetricResult>;
    memory: BenchmarkReport["memory"];
    concurrency: ConcurrencyEvidence;
  };
  passed: boolean;
  error?: string;
}

export interface BenchmarkCorpusSummary {
  schemaVersion: 1;
  kind: "capacity-performance-summary";
  authoritative: true;
  tier: "ceiling";
  seed: number;
  requiredRuns: number;
  completedRuns: number;
  samples: typeof CEILING_CORPUS;
  runtimes: BenchmarkRuntime[];
  evidenceFiles: string[];
  capacities: BenchmarkCapacities;
  thresholds: typeof BENCHMARK_THRESHOLDS;
  worst: {
    metrics: Record<string, {
      p50: number | null;
      p95: number | null;
      p99: number | null;
      budgetMs: number;
      passed: boolean;
    }>;
    memory: {
      valid: boolean;
      attributableRssBytes: number | null;
      budgetBytes: number;
      passed: boolean;
    };
    concurrency: {
      observed: number | null;
      p95Ms: number | null;
      budget: number;
      passed: boolean;
    };
  };
  failures: string[];
  passed: boolean;
}

export function createEvidenceResult(
  report: BenchmarkReport,
  run: number,
  runtime: BenchmarkRuntime,
): BenchmarkEvidenceResult {
  if (report.tier !== "ceiling") {
    throw new RangeError("authoritative evidence requires the ceiling tier");
  }
  return {
    schemaVersion: 1,
    kind: "capacity-performance-evidence",
    authoritative: true,
    run,
    runtime,
    tier: report.tier,
    seed: report.seed,
    samples: sampleCounts(report),
    thresholds: report.thresholds,
    capacities: report.capacities,
    observedCapacities: report.observedCapacities,
    measurements: {
      metrics: report.metrics,
      memory: report.memory,
      concurrency: report.concurrency,
    },
    passed: report.allPassed,
  };
}

export function createFailedEvidenceResult(
  run: number,
  runtime: BenchmarkRuntime,
  error: string,
): BenchmarkEvidenceResult {
  return {
    schemaVersion: 1,
    kind: "capacity-performance-evidence",
    authoritative: true,
    run,
    runtime,
    tier: "ceiling",
    seed: CEILING_CORPUS.seed,
    samples: {
      fast: CEILING_CORPUS.fastIterations,
      standard: CEILING_CORPUS.standardIterations,
      batch: CEILING_CORPUS.batchIterations,
    },
    thresholds: BENCHMARK_THRESHOLDS,
    capacities: BENCHMARK_TIERS.ceiling,
    passed: false,
    error,
  };
}

export function summarizeBenchmarkCorpus(
  results: readonly BenchmarkEvidenceResult[],
  evidenceFiles: readonly string[] = [],
): BenchmarkCorpusSummary {
  const failures: string[] = [];
  const expectedRuns = Array.from({ length: CEILING_CORPUS.runs }, (_, index) => index + 1);
  const actualRuns = results.map((result) => result.run).sort((a, b) => a - b);
  if (results.length !== CEILING_CORPUS.runs || actualRuns.some((run, index) => run !== expectedRuns[index])) {
    failures.push("corpus must contain exactly five uniquely numbered runs");
  }

  const runtimeKeys = new Set(
    results.map((result) => `${result.runtime.platform}/${result.runtime.arch}/${result.runtime.nodeVersion}`),
  );
  if (runtimeKeys.size > 1) failures.push("corpus must use one authoritative runtime");

  const capacities = BENCHMARK_TIERS.ceiling;
  const completedReports = results.filter(
    (result) => result.measurements && result.observedCapacities,
  );
  for (const result of results) {
    if (!isAuthoritativeCeilingRuntime(result.runtime)) {
      failures.push(`run ${result.run}: runtime is not an authoritative Linux x64 Node 22/24 runtime`);
    }
    if (!result.measurements || !result.observedCapacities) {
      failures.push(`run ${result.run}: benchmark process did not return a complete report`);
      continue;
    }
    if (result.tier !== "ceiling" || result.seed !== CEILING_CORPUS.seed) {
      failures.push(`run ${result.run}: tier or seed does not match the authoritative corpus`);
    }
    if (!hasExactCapacities(result.capacities, capacities)) {
      failures.push(`run ${result.run}: declared capacities do not match the authoritative ceiling`);
    }
    if (!hasExpectedSamples(result.measurements.metrics)) {
      failures.push(`run ${result.run}: sample counts do not match 20/10/5`);
    }
    if (
      result.samples.fast !== CEILING_CORPUS.fastIterations ||
      result.samples.standard !== CEILING_CORPUS.standardIterations ||
      result.samples.batch !== CEILING_CORPUS.batchIterations
    ) {
      failures.push(`run ${result.run}: evidence sample counts do not match 20/10/5`);
    }
    if (!hasApprovedThresholds(result.thresholds)) {
      failures.push(`run ${result.run}: thresholds do not match the approved release baseline`);
    }
    if (!hasExactCapacities(result.observedCapacities, capacities)) {
      failures.push(`run ${result.run}: observed capacities do not match the declared ceiling`);
    }
    if (!result.measurements.memory.valid) {
      failures.push(`run ${result.run}: attributable RSS measurement is invalid`);
    }
    if (!result.passed) failures.push(`run ${result.run}: one or more release thresholds failed`);
  }

  const worstMetrics: BenchmarkCorpusSummary["worst"]["metrics"] = {};
  for (const name of REQUIRED_BENCHMARK_METRICS) {
    const metrics = completedReports.map((result) => result.measurements!.metrics[name]);
    const available = metrics.filter((metric): metric is MetricResult => metric !== undefined);
    const p95 = available.length === completedReports.length && available.length > 0
      ? Math.max(...available.map((metric) => metric.percentiles.p95))
      : null;
    worstMetrics[name] = {
      p50: available.length === completedReports.length && available.length > 0
        ? Math.max(...available.map((metric) => metric.percentiles.p50))
        : null,
      p95,
      p99: available.length === completedReports.length && available.length > 0
        ? Math.max(...available.map((metric) => metric.percentiles.p99))
        : null,
      budgetMs: available[0]?.budgetMs ?? 0,
      passed:
        available.length === completedReports.length &&
        available.length > 0 &&
        available.every((metric) => metric.passed),
    };
  }

  const memoryValues = completedReports.map((result) => result.measurements!.memory);
  const memoryValid = memoryValues.length === results.length && memoryValues.every((memory) => memory.valid);
  const attributableRssBytes = memoryValid && memoryValues.length > 0
    ? Math.max(...memoryValues.map((memory) => memory.attributableRssBytes))
    : null;
  const memoryPassed = memoryValid && memoryValues.every((memory) => memory.passed);

  const concurrencyValues = completedReports.map((result) => result.measurements!.concurrency);
  const concurrencyComplete = concurrencyValues.length === results.length;
  const concurrency = {
    observed: concurrencyComplete && concurrencyValues.length > 0
      ? Math.max(...concurrencyValues.map((value) => value.observed))
      : null,
    p95Ms: concurrencyComplete && concurrencyValues.length > 0
      ? Math.max(...concurrencyValues.map((value) => value.p95Ms))
      : null,
    budget: BENCHMARK_THRESHOLDS.maxConcurrentProcesses,
    passed: concurrencyComplete && concurrencyValues.length > 0 && concurrencyValues.every((value) => value.passed),
  };

  const passed =
    failures.length === 0 &&
    completedReports.length === results.length &&
    Object.values(worstMetrics).every((metric) => metric.passed) &&
    memoryPassed &&
    concurrency.passed;

  return {
    schemaVersion: 1,
    kind: "capacity-performance-summary",
    authoritative: true,
    tier: "ceiling",
    seed: CEILING_CORPUS.seed,
    requiredRuns: CEILING_CORPUS.runs,
    completedRuns: completedReports.length,
    samples: CEILING_CORPUS,
    runtimes: results.map((result) => result.runtime),
    evidenceFiles: [...evidenceFiles],
    capacities,
    thresholds: BENCHMARK_THRESHOLDS,
    worst: {
      metrics: worstMetrics,
      memory: {
        valid: memoryValid,
        attributableRssBytes,
        budgetBytes: BENCHMARK_THRESHOLDS.rssBytes,
        passed: memoryPassed,
      },
      concurrency,
    },
    failures: [...new Set(failures)],
    passed,
  };
}

function sampleCounts(report: BenchmarkReport): BenchmarkEvidenceResult["samples"] {
  const fastSamples = report.metrics.getNode?.percentiles.samples ?? 0;
  const standardSamples = report.metrics.open?.percentiles.samples ?? 0;
  const batchSamples = report.metrics.report?.percentiles.samples ?? 0;
  return { fast: fastSamples, standard: standardSamples, batch: batchSamples };
}

function hasExpectedSamples(metrics: Record<string, MetricResult>): boolean {
  const fast = ["getNode", "listNodes", "listEdges", "getFrontier", "getOpenUnknowns"];
  const standard = ["open", "addNode", "updateNode", "addEdge", "gate", "verify", "concurrency"];
  const batch = ["report", "projectionRebuild", "migrationDryRun"];
  return (
    fast.every((name) => metrics[name]?.percentiles.samples === CEILING_CORPUS.fastIterations) &&
    standard.every((name) => metrics[name]?.percentiles.samples === CEILING_CORPUS.standardIterations) &&
    batch.every((name) => metrics[name]?.percentiles.samples === CEILING_CORPUS.batchIterations)
  );
}

function hasExactCapacities(
  observed: BenchmarkReport["observedCapacities"],
  declared: BenchmarkCapacities,
): boolean {
  return Object.keys(declared).every(
    (key) => observed[key as keyof BenchmarkCapacities] === declared[key as keyof BenchmarkCapacities],
  );
}

function hasApprovedThresholds(thresholds: typeof BENCHMARK_THRESHOLDS): boolean {
  return (
    thresholds.fastMs === BENCHMARK_THRESHOLDS.fastMs &&
    thresholds.standardMs === BENCHMARK_THRESHOLDS.standardMs &&
    thresholds.batchMs === BENCHMARK_THRESHOLDS.batchMs &&
    thresholds.rssBytes === BENCHMARK_THRESHOLDS.rssBytes &&
    thresholds.maxConcurrentProcesses === BENCHMARK_THRESHOLDS.maxConcurrentProcesses
  );
}
