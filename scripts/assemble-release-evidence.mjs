#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectFiles(root) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  walk(root);
  return files;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function findFile(root, name) {
  const matches = collectFiles(root).filter((path) => path.endsWith(`/${name}`) || path.endsWith(`\\${name}`));
  if (matches.length !== 1) throw new Error(`expected exactly one ${name} below ${root}, found ${matches.length}`);
  return matches[0];
}

export function assembleReleaseEvidence({ input = "release-evidence", output = "release-evidence/EVD-RELEASE.json" } = {}) {
  const root = resolve(input);
  const preflightPath = join(root, "EVD-RELEASE-PRE.json");
  const postPath = join(root, "EVD-RELEASE-POST.json");
  const preflight = readJson(preflightPath);
  const post = readJson(postPath);
  const benchmarkReceipts = ["node22", "node24"].map((node) => readJson(findFile(join(root, `benchmark-${node}`), `EVD-CI-PASS-${node}.json`)));
  const benchmarkSummaries = ["node22", "node24"].map((node) =>
    readJson(findFile(join(root, `benchmark-${node}`), "EVD-BENCH-SUMMARY.json")),
  );

  if (!Object.values(preflight.gates ?? {}).every(Boolean)) throw new Error("preflight evidence contains a failed gate");
  if (post.registry?.available !== true || post.distTags?.latest !== preflight.package?.version) {
    throw new Error("post-publication evidence does not prove registry availability and latest dist-tag");
  }
  if (post.cli?.passed !== true || post.signatures?.passed !== true) {
    throw new Error("post-publication evidence does not prove CLI and signature checks");
  }
  if (benchmarkSummaries.some((summary) => summary.passed !== true)) {
    throw new Error("release evidence contains a failed benchmark summary");
  }
  if (benchmarkReceipts.some((receipt) => receipt.all_passed !== true)) {
    throw new Error("release evidence contains a failed benchmark receipt");
  }

  const sourceFiles = collectFiles(root).filter((path) => resolve(path) !== resolve(output));
  const evidence = {
    schemaVersion: 1,
    kind: "ariadne-release-evidence-bundle",
    reproducible: true,
    package: preflight.package,
    tag: preflight.tag,
    commit: preflight.commit,
    preflight,
    benchmark: { receipts: benchmarkReceipts, summaries: benchmarkSummaries },
    postPublication: post,
    sourceFiles: sourceFiles.map((path) => ({ path: relative(root, path), sha256: sha256(path) })),
  };
  writeFileSync(resolve(output), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Wrote complete release evidence bundle to ${resolve(output)}`);
  return evidence;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    assembleReleaseEvidence({ input: argument("--input"), output: argument("--output") });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
