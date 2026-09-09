#!/usr/bin/env node
/**
 * Conservative local screening for the supported Linux ceiling benchmark.
 * This command never produces authoritative CI evidence.
 */

import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const workerPath = resolve(repoRoot, "scripts/run-benchmark-once.mjs");

function parseArgs(args) {
  const options = {
    runs: 5,
    seed: 42,
    safetyFactor: 0.75,
    output: "LOCAL-BENCH-PREFLIGHT.json",
    fastIterations: 20,
    standardIterations: 10,
    batchIterations: 5,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];
    if (arg === "--help" || arg === "-h") {
      console.log(`Usage: node --import tsx/esm scripts/run-local-preflight.mjs [options]

Options:
  --runs <number>             Independent runs (default: 5)
  --seed <number>             Deterministic seed (default: 42)
  --safety-factor <number>    Local budget fraction, 0 < value <= 1 (default: 0.75)
  --output <path>             JSON output path (default: LOCAL-BENCH-PREFLIGHT.json)
  --fast-iterations <number>  Samples per run (default: 20)
  --standard-iterations <number> Samples per run (default: 10)
  --batch-iterations <number> Samples per run (default: 5)
`);
      process.exit(0);
    }
    if (["--runs", "--seed", "--safety-factor", "--output", "--fast-iterations", "--standard-iterations", "--batch-iterations"].includes(arg)) {
      if (next === undefined) throw new Error(`Missing value for ${arg}`);
      const key = {
        "--runs": "runs",
        "--seed": "seed",
        "--safety-factor": "safetyFactor",
        "--output": "output",
        "--fast-iterations": "fastIterations",
        "--standard-iterations": "standardIterations",
        "--batch-iterations": "batchIterations",
      }[arg];
      options[key] = arg === "--output" ? next : Number(next);
      index += 1;
    }
  }

  if (!Number.isInteger(options.runs) || options.runs < 1) throw new Error("--runs must be a positive integer");
  if (!Number.isInteger(options.seed)) throw new Error("--seed must be an integer");
  if (!Number.isFinite(options.safetyFactor) || options.safetyFactor <= 0 || options.safetyFactor > 1) {
    throw new Error("--safety-factor must be greater than 0 and at most 1");
  }
  for (const key of ["fastIterations", "standardIterations", "batchIterations"]) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} must be a positive integer`);
  }
  return options;
}

function runOne(options, run) {
  return new Promise((resolveRun) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx/esm",
        workerPath,
        "--tier",
        "ceiling",
        "--seed",
        String(options.seed),
        "--fast-iterations",
        String(options.fastIterations),
        "--standard-iterations",
        String(options.standardIterations),
        "--batch-iterations",
        String(options.batchIterations),
      ],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], shell: false },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => resolveRun({ run, report: null, error: error.message }));
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        resolveRun({
          run,
          report: null,
          error: `worker exited with ${signal ?? `code ${code}`}: ${stderr.trim()}`,
        });
        return;
      }
      try {
        resolveRun({ run, report: JSON.parse(stdout) });
      } catch (error) {
        resolveRun({
          run,
          report: null,
          error: `worker returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { evaluateLocalPreflight } = await import(resolve(repoRoot, "tests/benchmarks/preflight.ts"));
  const runs = [];
  for (let run = 1; run <= options.runs; run += 1) {
    console.log(`[${run}/${options.runs}] Running isolated local ceiling benchmark...`);
    runs.push(await runOne(options, run));
  }

  const evaluation = evaluateLocalPreflight(runs, {
    requiredRuns: options.runs,
    safetyFactor: options.safetyFactor,
  });
  const supportedNodeMajor = [22, 24].includes(Number(process.versions.node.split(".")[0]));
  const verdict = supportedNodeMajor ? evaluation.verdict : "uncertain";
  const result = {
    ...evaluation,
    ciPreflightPassed: supportedNodeMajor && evaluation.ciPreflightPassed,
    verdict,
    timestamp: new Date().toISOString(),
    runtime: {
      version: process.version,
      execPath: process.execPath,
      platform: process.platform,
      arch: process.arch,
      supportedNodeMajor,
    },
    seed: options.seed,
    samples: {
      fast: options.fastIterations,
      standard: options.standardIterations,
      batch: options.batchIterations,
    },
    runs,
  };
  const outputPath = resolve(process.cwd(), options.output);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  console.log(`\nLocal screening verdict: ${verdict.toUpperCase()}`);
  console.log(`Local contract: ${evaluation.localContractPassed ? "PASS" : "FAIL"}`);
  console.log(`Conservative CI preflight: ${result.ciPreflightPassed ? "PASS" : "FAIL"}`);
  if (!supportedNodeMajor) {
    console.log("Runtime is outside the supported Node 22/24 matrix; CI prediction is uncertain.");
  }
  console.log(`Wrote ${outputPath}`);
  if (verdict !== "likely-pass") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
