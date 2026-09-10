#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const summaryPath = resolve(process.cwd(), argument("--summary", "benchmark-evidence/EVD-BENCH-SUMMARY.json"));
const outputPath = resolve(process.cwd(), argument("--output", "EVD-CI-PASS.json"));
const summary = JSON.parse(await readFile(summaryPath, "utf8"));

if (summary.kind !== "capacity-performance-summary" || summary.passed !== true) {
  throw new Error("cannot create a CI pass receipt from a missing or failed benchmark summary");
}

const runtime = summary.runtimes.length === 1 ? summary.runtimes[0] : null;
if (!runtime) throw new Error("benchmark summary must identify exactly one runtime");

const receipt = {
  schemaVersion: 1,
  kind: "ci-capacity-performance-gate",
  timestamp: new Date().toISOString(),
  commitSha: process.env.GITHUB_SHA ?? null,
  matrixJob: process.env.GITHUB_JOB ?? null,
  runner: {
    name: process.env.RUNNER_NAME ?? null,
    os: process.env.RUNNER_OS ?? null,
    environment: process.env.RUNNER_ENVIRONMENT ?? null,
  },
  runtime,
  benchmark: {
    tier: summary.tier,
    seed: summary.seed,
    requiredRuns: summary.requiredRuns,
    completedRuns: summary.completedRuns,
    samples: summary.samples,
    capacities: summary.capacities,
    thresholds: summary.thresholds,
    evidenceFiles: summary.evidenceFiles,
    worst: summary.worst,
  },
  all_passed: summary.passed,
};

await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`Wrote CI pass evidence to ${outputPath}`);
