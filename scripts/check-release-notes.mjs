#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function packageVersion() {
  return JSON.parse(await readFile(resolve("package.json"), "utf8")).version;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractReleaseNotes(changelog, version) {
  const versionPattern = escapeRegExp(version);
  const headingPattern = new RegExp(`^## \\[?${versionPattern}\\]?\\s*(?:-|$)`, "m");
  const heading = headingPattern.exec(changelog);
  if (!heading) {
    throw new Error(`CHANGELOG.md does not contain a release heading for ${version}`);
  }

  const bodyStart = heading.index + heading[0].length;
  const nextHeading = changelog.slice(bodyStart).search(/^## /m);
  const body = changelog.slice(bodyStart, nextHeading < 0 ? undefined : bodyStart + nextHeading).trim();
  if (!body || !/^###?\s+\S+/m.test(body)) {
    throw new Error(`CHANGELOG.md release section for ${version} has no structured release notes`);
  }
  return body;
}

export async function verifyReleaseNotes({
  version,
  changelogPath = "CHANGELOG.md",
  outputPath,
} = {}) {
  const resolvedVersion = version ?? await packageVersion();
  const changelog = await readFile(resolve(changelogPath), "utf8");
  const notes = extractReleaseNotes(changelog, resolvedVersion);
  if (outputPath) {
    await writeFile(resolve(outputPath), `${notes}\n`, "utf8");
  }
  return { version: resolvedVersion, notes };
}

async function main() {
  const result = await verifyReleaseNotes({
    version: argument("--version"),
    changelogPath: argument("--changelog", "CHANGELOG.md"),
    outputPath: argument("--output"),
  });
  console.log(`Release notes verified for ${result.version}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
