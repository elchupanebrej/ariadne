#!/usr/bin/env node
/**
 * Ariadne Capacity & Performance Benchmark CLI Runner.
 * Executes configurable tier benchmarks (smoke, mid, ceiling),
 * measures latency classes (Fast <100ms, Standard <1s, Batch <10s),
 * verifies 256 MB peak RSS ceiling, and outputs structured JSON report.
 *
 * Usage:
 *   npm run benchmark -- [options]
 *   node --import tsx/esm scripts/run-benchmark.mjs [options]
 *
 * Options:
 *   --tier <smoke|mid|ceiling>   Benchmark tier to run (default: smoke)
 *   --seed <number>              PRNG seed (default: 42)
 *   --output <path>              Output JSON report path (default: EVD-BENCH-PASS.json)
 *   -h, --help                   Show help
 */

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

function parseArgs(args) {
  let tier = "smoke";
  let seed = 42;
  let output = "EVD-BENCH-PASS.json";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--tier" && args[i + 1]) {
      tier = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--tier=")) {
      tier = arg.slice(7);
    } else if (arg === "--seed" && args[i + 1]) {
      seed = Number.parseInt(args[i + 1], 10);
      i += 1;
    } else if (arg.startsWith("--seed=")) {
      seed = Number.parseInt(arg.slice(7), 10);
    } else if (arg === "--output" && args[i + 1]) {
      output = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--output=")) {
      output = arg.slice(9);
    } else if (arg === "-h" || arg === "--help") {
      console.log(`Usage: npm run benchmark -- [options]

Options:
  --tier <smoke|mid|ceiling>   Benchmark tier to run (default: smoke)
  --seed <number>              PRNG seed for reproducible graph generation (default: 42)
  --output <path>              Path to write structured JSON report (default: EVD-BENCH-PASS.json)
  -h, --help                   Show this help message
`);
      process.exit(0);
    }
  }

  if (!["smoke", "mid", "ceiling"].includes(tier)) {
    console.error(`Error: Unknown tier '${tier}'. Valid options: smoke, mid, ceiling`);
    process.exit(1);
  }

  return { tier, seed, output };
}

async function main() {
  const { tier, seed, output } = parseArgs(process.argv.slice(2));

  console.log(`=======================================================`);
  console.log(` Ariadne Performance & Capacity Benchmark Runner`);
  console.log(` Tier: ${tier.toUpperCase()} | Seed: ${seed}`);
  console.log(`=======================================================\n`);

  // Import benchmark runner — supports tsx/esm loader
  console.log(`[1/3] Loading benchmark runner...`);

  let runBenchmark;
  try {
    const runnerPath = resolve(repoRoot, "tests/benchmarks/runner.ts");
    const mod = await import(runnerPath);
    runBenchmark = mod.runBenchmark;
  } catch (importErr) {
    // Fallback: try compiled dist if tsx isn't available
    try {
      const distPath = resolve(repoRoot, "dist/tests/benchmarks/runner.js");
      const mod = await import(distPath);
      runBenchmark = mod.runBenchmark;
    } catch {
      console.error(`Failed to load benchmark runner. Run 'npm ci' and then 'npm run benchmark -- --tier ceiling'.`);
      console.error(`Or build first: npm run build`);
      console.error(`Original error:`, importErr.message);
      process.exit(1);
    }
  }

  console.log(`[2/3] Running ${tier} tier benchmark suite...`);
  const startTime = performance.now();
  const report = await runBenchmark({ tier, seed });
  const totalDurationMs = performance.now() - startTime;

  console.log(`[3/3] Benchmark execution completed in ${(totalDurationMs / 1000).toFixed(2)}s.\n`);

  // Print summary table
  console.log(`--- LATENCY METRICS ---`);
  console.table(
    Object.entries(report.metrics).map(([name, m]) => ({
      Operation: name,
      Tier: m.tier,
      "Budget (ms)": m.budgetMs,
      "p50 (ms)": m.percentiles.p50,
      "p95 (ms)": m.percentiles.p95,
      "p99 (ms)": m.percentiles.p99,
      Samples: m.percentiles.samples,
      Passed: m.passed ? "PASS" : "FAIL",
    })),
  );

  console.log(`\n--- MEMORY CEILING ---`);
  console.log(`Peak Process RSS:     ${report.memory.peakRssMb} MB`);
  console.log(`Attributable RSS:     ${(report.memory.attributableRssBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`RSS Ceiling Budget:   ${(report.memory.budgetBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(
    `Memory Check:         ${report.memory.passed ? "PASS" : "FAIL (invalid or over budget)"}\n`,
  );

  // Build EVD-BENCH-PASS.json compatible structure
  const evdReport = {
    schemaVersion: 1,
    kind: "capacity-performance-evidence",
    authoritative: false,
    timestamp: report.timestamp,
    runtime: {
      nodeVersion: process.version,
      nodeMajor: Number(process.versions.node.split(".")[0]),
      platform: process.platform,
      arch: process.arch,
    },
    tier: report.tier,
    seed: report.seed,
    samples: {
      fast: report.metrics.getNode?.percentiles.samples ?? 0,
      standard: report.metrics.open?.percentiles.samples ?? 0,
      batch: report.metrics.report?.percentiles.samples ?? 0,
    },
    tier_results: {
      fast: buildTierSummary(report.metrics, "fast", report.thresholds.fastMs),
      standard: buildTierSummary(report.metrics, "standard", report.thresholds.standardMs),
      batch: buildTierSummary(report.metrics, "batch", report.thresholds.batchMs),
    },
    peak_rss_bytes: report.memory.peakRssBytes,
    rss_valid: report.memory.valid,
    rss_passed: report.memory.passed,
    capacities: report.capacities,
    observed_capacities: report.observedCapacities,
    thresholds: report.thresholds,
    concurrency: report.concurrency,
    metrics: report.metrics,
    memory: report.memory,
    passed: report.allPassed,
    allPassed: report.allPassed,
  };

  // Write structured JSON report
  const resolvedOutput = resolve(process.cwd(), output);
  writeFileSync(resolvedOutput, JSON.stringify(evdReport, null, 2) + "\n", "utf8");
  console.log(`Wrote benchmark report to: ${resolvedOutput}`);

  if (!report.allPassed) {
    console.error(`\n❌ BENCHMARK FAILED: One or more performance/memory budgets were breached.`);
    process.exit(1);
  } else {
    console.log(`\n✅ BENCHMARK PASSED: All latency and memory budgets met.`);
    process.exit(0);
  }
}

function buildTierSummary(metrics, tierName, budgetMs) {
  const tierMetrics = Object.values(metrics).filter((m) => m.tier === tierName);
  if (tierMetrics.length === 0) {
    return { p50: 0, p95: 0, p99: 0, budget_ms: budgetMs, passed: true };
  }
  const maxP50 = Math.max(...tierMetrics.map((m) => m.percentiles.p50));
  const maxP95 = Math.max(...tierMetrics.map((m) => m.percentiles.p95));
  const maxP99 = Math.max(...tierMetrics.map((m) => m.percentiles.p99));
  return {
    p50: maxP50,
    p95: maxP95,
    p99: maxP99,
    budget_ms: budgetMs,
    passed: tierMetrics.every((m) => m.passed),
  };
}

main().catch((err) => {
  console.error("Fatal benchmark runner error:", err);
  process.exit(1);
});
