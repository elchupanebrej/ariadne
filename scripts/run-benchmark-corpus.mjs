#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputDir = resolve(process.cwd(), "benchmark-evidence");
const workerPath = resolve(repoRoot, "scripts/run-benchmark-once.mjs");
const runTimeoutMs = 180_000;

const {
  AUTHORITATIVE_NODE_VERSIONS,
  CEILING_CORPUS,
  createEvidenceResult,
  createFailedEvidenceResult,
  isAuthoritativeCeilingRuntime,
  summarizeBenchmarkCorpus,
} = await import(resolve(repoRoot, "tests/benchmarks/corpus.ts"));

function runtime() {
  return {
    nodeVersion: process.version,
    nodeMajor: Number(process.versions.node.split(".")[0]),
    platform: process.platform,
    arch: process.arch,
  };
}

function assertSupportedRuntime() {
  const current = runtime();
  if (!isAuthoritativeCeilingRuntime(current)) {
    throw new Error(
      `authoritative ceiling corpus requires Linux x64 Node ${AUTHORITATIVE_NODE_VERSIONS.join(" or ")}; got ${current.platform}/${current.arch} ${current.nodeVersion}`,
    );
  }
  return current;
}

function runOne(run) {
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
        String(CEILING_CORPUS.seed),
        "--fast-iterations",
        String(CEILING_CORPUS.fastIterations),
        "--standard-iterations",
        String(CEILING_CORPUS.standardIterations),
        "--batch-iterations",
        String(CEILING_CORPUS.batchIterations),
      ],
      { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"], shell: false },
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, runTimeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolveRun({ run, report: null, error: error.message });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        resolveRun({ run, report: null, error: `worker timed out after ${runTimeoutMs} ms` });
        return;
      }
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
  const currentRuntime = assertSupportedRuntime();
  await mkdir(outputDir, { recursive: true });
  const evidence = [];
  const evidenceFiles = [];

  for (let run = 1; run <= CEILING_CORPUS.runs; run += 1) {
    console.log(`[${run}/${CEILING_CORPUS.runs}] Running isolated ceiling benchmark on ${currentRuntime.nodeVersion}...`);
    const outcome = await runOne(run);
    const result = outcome.report
      ? createEvidenceResult(outcome.report, run, currentRuntime)
      : createFailedEvidenceResult(run, currentRuntime, outcome.error ?? "unknown worker failure");
    const fileName = `EVD-BENCH-PASS-node${currentRuntime.nodeMajor}-run-${run}.json`;
    await writeFile(resolve(outputDir, fileName), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    evidence.push(result);
    evidenceFiles.push(fileName);
  }

  const summary = summarizeBenchmarkCorpus(evidence, evidenceFiles);
  await writeFile(resolve(outputDir, "EVD-BENCH-SUMMARY.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`Wrote ${evidence.length} Evidence Results and EVD-BENCH-SUMMARY.json to ${outputDir}`);
  if (!summary.passed) {
    console.error(JSON.stringify({ failures: summary.failures }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
