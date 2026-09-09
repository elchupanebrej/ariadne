#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const args = process.argv.slice(2);
const tier = args[args.indexOf("--tier") + 1] ?? "ceiling";
const seed = Number.parseInt(args[args.indexOf("--seed") + 1] ?? "42", 10);
const fastIterations = Number.parseInt(args[args.indexOf("--fast-iterations") + 1] ?? "20", 10);
const standardIterations = Number.parseInt(
  args[args.indexOf("--standard-iterations") + 1] ?? "10",
  10,
);
const batchIterations = Number.parseInt(args[args.indexOf("--batch-iterations") + 1] ?? "5", 10);

try {
  const { runBenchmark } = await import(resolve(repoRoot, "tests/benchmarks/runner.ts"));
  const report = await runBenchmark({
    tier,
    seed,
    fastIterations,
    standardIterations,
    batchIterations,
  });
  process.stdout.write(JSON.stringify(report));
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
}
