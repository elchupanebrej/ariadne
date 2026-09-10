#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const CANONICAL_SKILLS = ["ariadne", "codebase-design", "grilling", "domain-modeling"];

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function evidencePath(path) {
  return relative(process.cwd(), resolve(path)).split(sep).join("/");
}

function tarEntries(tarball) {
  return execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
    .split("\n")
    .map((entry) => entry.trim().replace(/^\.\//, ""))
    .filter(Boolean)
    .sort();
}

function assertProductionTarball(entries, packageJson) {
  const required = [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/dist/cli/index.js",
    ...CANONICAL_SKILLS.map((skill) => `package/.agents/skills/${skill}/SKILL.md`),
  ];
  for (const entry of required) {
    if (!entries.includes(entry)) throw new Error(`release tarball is missing ${entry}`);
  }

  const allowed = (entry) =>
    /^package\/(?:package\.json|README\.md|LICENSE)$/.test(entry) ||
    /^package\/dist\//.test(entry) ||
    CANONICAL_SKILLS.some((skill) => entry.startsWith(`package/.agents/skills/${skill}/`));
  for (const entry of entries) {
    if (!allowed(entry)) throw new Error(`release tarball contains unapproved entry ${entry}`);
  }

  const packageName = packageJson.name;
  const packageVersion = packageJson.version;
  if (!packageName || !packageVersion) throw new Error("package.json must declare name and version");
}

export async function writePreflightEvidence({
  tarball,
  output = "release-evidence/EVD-RELEASE-PRE.json",
  tag = process.env.GITHUB_REF_NAME ?? `v${JSON.parse(readFileSync(resolve("package.json"), "utf8")).version}`,
  commit = process.env.GITHUB_SHA ?? null,
  benchmarkSummaries = [],
} = {}) {
  if (!tarball) throw new Error("--tarball is required for release preflight evidence");
  const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
  const tarballPath = resolve(tarball);
  const entries = tarEntries(tarballPath);
  assertProductionTarball(entries, packageJson);
  if (benchmarkSummaries.length === 0) throw new Error("at least one benchmark summary is required");
  const summaries = benchmarkSummaries.map((path) => JSON.parse(readFileSync(resolve(path), "utf8")));
  if (summaries.some((summary) => summary.kind !== "capacity-performance-summary" || summary.passed !== true)) {
    throw new Error("release benchmark summaries must all be passing authoritative summaries");
  }
  const evidence = {
    schemaVersion: 1,
    kind: "release-preflight-evidence",
    package: { name: packageJson.name, version: packageJson.version },
    tag,
    commit,
    gates: {
      releaseNotes: true,
      build: true,
      typecheck: true,
      test: true,
      benchmark: true,
      tarballAllowlist: true,
      cleanConsumer: true,
    },
    benchmark: summaries,
    tarball: {
      file: evidencePath(tarballPath),
      sha256: sha256(tarballPath),
      entries,
      canonicalSkills: CANONICAL_SKILLS,
    },
  };
  mkdirSync(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`Wrote release preflight evidence to ${resolve(output)}`);
  return evidence;
}

async function main() {
  const benchmarkSummaries = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === "--benchmark-summary" && process.argv[index + 1]) {
      benchmarkSummaries.push(process.argv[index + 1]);
    }
  }
  await writePreflightEvidence({
    tarball: argument("--tarball"),
    output: argument("--output"),
    benchmarkSummaries,
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
