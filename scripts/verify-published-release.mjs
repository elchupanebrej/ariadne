#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REGISTRY_POLL_TIMEOUT_MS = 180_000;
const REGISTRY_POLL_INITIAL_DELAY_MS = 1_000;
const REGISTRY_POLL_MAX_DELAY_MS = 30_000;

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function run(command, args, cwd) {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    const stderr = error.stderr?.toString() ?? "";
    throw new Error(`${command} ${args.join(" ")} failed\n${stdout}\n${stderr}`.trim());
  }
}

function packageMetadata() {
  return JSON.parse(readFileSync(resolve("package.json"), "utf8"));
}

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function waitForRegistryVersion(packageSpec, expectedVersion) {
  const deadline = Date.now() + REGISTRY_POLL_TIMEOUT_MS;
  let delay = REGISTRY_POLL_INITIAL_DELAY_MS;
  let lastObservation = "package was not available";

  while (Date.now() < deadline) {
    try {
      const observedVersion = JSON.parse(run("npm", ["view", packageSpec, "version", "--json"]));
      if (observedVersion === expectedVersion) return observedVersion;
      lastObservation = `registry returned ${observedVersion ?? "no version"}`;
    } catch (error) {
      lastObservation = error instanceof Error ? error.message : String(error);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const waitMilliseconds = Math.min(delay, remaining);
    console.log(`Package ${packageSpec} is not ready (${lastObservation}); retrying in ${Math.ceil(waitMilliseconds / 1000)}s`);
    sleep(waitMilliseconds);
    delay = Math.min(delay * 2, REGISTRY_POLL_MAX_DELAY_MS);
  }

  throw new Error(`package ${packageSpec} did not become available within 180 seconds: ${lastObservation}`);
}

export function verifyPublishedRelease({
  packageName = packageMetadata().name,
  version = packageMetadata().version,
  output = "release-evidence/EVD-RELEASE-POST.json",
} = {}) {
  const packageSpec = `${packageName}@${version}`;
  const registryVersion = waitForRegistryVersion(packageSpec, version);

  const distTags = JSON.parse(run("npm", ["view", packageName, "dist-tags", "--json"]));
  if (distTags.latest !== version) {
    throw new Error(`latest dist-tag is ${distTags.latest ?? "missing"}, expected ${version}`);
  }

  const consumer = mkdtempSync(join(tmpdir(), "ariadne-release-consumer-"));
  try {
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "ariadne-release-consumer", type: "module" }));
    run("npm", ["install", packageSpec, "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
    const cliOutput = run("npm", ["exec", "--yes", `--package=${packageSpec}`, "--", "ariadne", "--version"], consumer);
    if (!cliOutput.split(/\r?\n/).some((line) => line.trim() === version)) {
      throw new Error(`CLI output did not contain the exact version ${version}: ${cliOutput}`);
    }
    const signatureOutput = run("npm", ["audit", "signatures"], consumer);

    const evidence = {
      schemaVersion: 1,
      kind: "release-post-publication-evidence",
      package: { name: packageName, version },
      registry: { available: true, version: registryVersion },
      distTags: { latest: distTags.latest },
      cli: { command: "npm exec --yes --package=<package>@<version> -- ariadne --version", output: cliOutput, passed: true },
      signatures: { command: "npm audit signatures", output: signatureOutput, passed: true },
      commit: process.env.GITHUB_SHA ?? null,
    };
    mkdirSync(dirname(resolve(output)), { recursive: true });
    writeFileSync(resolve(output), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(`Wrote release post-publication evidence to ${resolve(output)}`);
    return evidence;
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  verifyPublishedRelease({ output: argument("--output") });
}
