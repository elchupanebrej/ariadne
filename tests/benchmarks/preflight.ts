import {
  BENCHMARK_THRESHOLDS,
  type BenchmarkCapacities,
} from "./generator.js";
import type { BenchmarkReport } from "./runner.js";

export const DEFAULT_LOCAL_PREFLIGHT_RUNS = 5;
export const DEFAULT_LOCAL_SAFETY_FACTOR = 0.75;

export interface LocalPreflightRun {
  run: number;
  report: BenchmarkReport | null;
  error?: string;
}

export interface LocalPreflightOptions {
  requiredRuns?: number;
  safetyFactor?: number;
}

export interface ConservativeThresholds {
  fastMs: number;
  standardMs: number;
  batchMs: number;
  rssBytes: number;
}

export interface LocalPreflightMetricSummary {
  p95Ms: number | null;
  releaseBudgetMs: number;
  preflightBudgetMs: number;
  passed: boolean;
}

export type LocalPreflightVerdict = "likely-pass" | "uncertain" | "likely-fail";

export interface LocalPreflightEvaluation {
  mode: "local-preflight";
  authoritative: false;
  requiredRuns: number;
  completedRuns: number;
  safetyFactor: number;
  releaseThresholds: typeof BENCHMARK_THRESHOLDS;
  conservativeThresholds: ConservativeThresholds;
  localContractPassed: boolean;
  ciPreflightPassed: boolean;
  verdict: LocalPreflightVerdict;
  capacitiesPassed: boolean;
  rssValid: boolean;
  worstAttributableRssBytes: number | null;
  worstMetrics: Record<string, LocalPreflightMetricSummary>;
  failures: string[];
  limitations: string[];
}

const CAPACITY_KEYS: readonly (keyof BenchmarkCapacities)[] = [
  "nodes",
  "edges",
  "events",
  "cards",
  "reports",
  "processes",
];

export function buildConservativeThresholds(
  safetyFactor = DEFAULT_LOCAL_SAFETY_FACTOR,
): ConservativeThresholds {
  validateSafetyFactor(safetyFactor);
  return {
    fastMs: Number((BENCHMARK_THRESHOLDS.fastMs * safetyFactor).toFixed(3)),
    standardMs: Number((BENCHMARK_THRESHOLDS.standardMs * safetyFactor).toFixed(3)),
    batchMs: Number((BENCHMARK_THRESHOLDS.batchMs * safetyFactor).toFixed(3)),
    rssBytes: Math.floor(BENCHMARK_THRESHOLDS.rssBytes * safetyFactor),
  };
}

export function evaluateLocalPreflight(
  runs: readonly LocalPreflightRun[],
  options: LocalPreflightOptions = {},
): LocalPreflightEvaluation {
  const requiredRuns = options.requiredRuns ?? DEFAULT_LOCAL_PREFLIGHT_RUNS;
  const safetyFactor = options.safetyFactor ?? DEFAULT_LOCAL_SAFETY_FACTOR;
  if (!Number.isInteger(requiredRuns) || requiredRuns < 1) {
    throw new RangeError("requiredRuns must be a positive integer");
  }
  validateSafetyFactor(safetyFactor);

  const conservativeThresholds = buildConservativeThresholds(safetyFactor);
  const reports = runs.flatMap((run) => (run.report ? [run.report] : []));
  const complete = runs.length === requiredRuns && reports.length === requiredRuns;
  const failures = runs.flatMap((run) => (run.error ? [`run ${run.run}: ${run.error}`] : []));

  const capacitiesPassed =
    complete && reports.every((report) => hasExactCapacities(report.observedCapacities, report.capacities));
  if (complete && !capacitiesPassed) {
    failures.push("one or more runs did not observe the exact declared capacities");
  }

  const rssValid = complete && reports.every((report) => report.memory.valid);
  if (complete && !rssValid) {
    failures.push("one or more runs produced invalid high-water RSS evidence");
  }

  const rssValues = reports
    .filter((report) => report.memory.valid)
    .map((report) => report.memory.attributableRssBytes);
  const worstAttributableRssBytes = rssValues.length > 0 ? Math.max(...rssValues) : null;
  if (worstAttributableRssBytes !== null && worstAttributableRssBytes > conservativeThresholds.rssBytes) {
    failures.push(
      `worst attributable RSS ${worstAttributableRssBytes} exceeds local preflight budget ${conservativeThresholds.rssBytes}`,
    );
  }

  const metricNames = new Set<string>();
  for (const report of reports) {
    for (const name of Object.keys(report.metrics)) metricNames.add(name);
  }

  const worstMetrics: Record<string, LocalPreflightMetricSummary> = {};
  for (const name of [...metricNames].sort()) {
    const metricValues = reports.map((report) => report.metrics[name]);
    const p95Values = metricValues.flatMap((metric) =>
      metric && Number.isFinite(metric.percentiles.p95) ? [metric.percentiles.p95] : [],
    );
    const releaseBudgetMs = metricValues.find((metric) => metric)?.budgetMs ?? 0;
    const preflightBudgetMs = Number((releaseBudgetMs * safetyFactor).toFixed(3));
    const p95Ms = p95Values.length === reports.length ? Math.max(...p95Values) : null;
    const passed =
      complete &&
      p95Ms !== null &&
      metricValues.every((metric) => metric !== undefined) &&
      p95Ms < preflightBudgetMs;
    worstMetrics[name] = {
      p95Ms,
      releaseBudgetMs,
      preflightBudgetMs,
      passed,
    };
    if (!passed) {
      failures.push(
        `${name} worst p95 ${p95Ms === null ? "unavailable" : p95Ms} does not satisfy local preflight budget ${preflightBudgetMs} ms`,
      );
    }
  }

  const localContractPassed = complete && reports.every((report) => report.allPassed);
  const ciPreflightPassed =
    localContractPassed &&
    capacitiesPassed &&
    rssValid &&
    Object.values(worstMetrics).every((metric) => metric.passed) &&
    (worstAttributableRssBytes ?? Number.POSITIVE_INFINITY) <= conservativeThresholds.rssBytes;

  const verdict: LocalPreflightVerdict =
    ciPreflightPassed ? "likely-pass" : localContractPassed ? "uncertain" : "likely-fail";

  return {
    mode: "local-preflight",
    authoritative: false,
    requiredRuns,
    completedRuns: reports.length,
    safetyFactor,
    releaseThresholds: BENCHMARK_THRESHOLDS,
    conservativeThresholds,
    localContractPassed,
    ciPreflightPassed,
    verdict,
    capacitiesPassed,
    rssValid,
    worstAttributableRssBytes,
    worstMetrics,
    failures: [...new Set(failures)],
    limitations: [
      "This is a local screening result, not CI Evidence Result.",
      "The safety factor is a conservative heuristic for local-to-CI variance, not a platform model.",
      "A slower local environment may produce a conservative false negative; a faster local environment cannot guarantee a CI pass.",
      "Only the clean supported Linux Node 22/24 CI runs can authorize the release baseline.",
    ],
  };
}

function validateSafetyFactor(safetyFactor: number): void {
  if (!Number.isFinite(safetyFactor) || safetyFactor <= 0 || safetyFactor > 1) {
    throw new RangeError("safetyFactor must be greater than 0 and at most 1");
  }
}

function hasExactCapacities(
  observed: BenchmarkCapacities,
  declared: BenchmarkCapacities,
): boolean {
  return CAPACITY_KEYS.every((key) => observed[key] === declared[key]);
}
