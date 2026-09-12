import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const PROTECTED_FILES = [
  "src/graph/storage.ts",
  "src/graph/storage-driver.ts",
  "src/graph/index.ts",
];

const ALLOWED_IMPORTERS: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "src/cli/commands/init.ts",
    reason:
      "sanctioned bootstrap exception: resolves --root and locks before an engine handle exists (ADR-0017)",
  },
  {
    file: "tests/graph/storage.test.ts",
    reason: "sanctioned storage test: subject is GraphStorage state validation",
  },
];

const SCAN_ROOTS = ["src", "tests", "scripts"];
const SCANNED_EXTENSIONS = [".ts", ".mjs", ".js", ".cjs"];
const SKIP_PREFIXES = ["src/graph/"];

const toRepoPath = (absolutePath: string): string =>
  relative(repoRoot, absolutePath).replaceAll("\\", "/");

const listSourceFiles = (directory: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(path));
    else if (entry.isFile() && SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      files.push(path);
    }
  }
  return files;
};

const importSpecifierPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;

const canonicalCandidates = (resolved: string): string[] => {
  const withoutJs = resolved.endsWith(".js") ? resolved.slice(0, -3) : resolved;
  return [resolved, `${withoutJs}.ts`, `${withoutJs}/index.ts`];
};

const importsOfProtectedFile = (file: string): string[] => {
  const specifiers: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(importSpecifierPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolved = toRepoPath(resolve(join(file, ".."), specifier));
    if (canonicalCandidates(resolved).some((candidate) => PROTECTED_FILES.includes(candidate))) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
};

const allowlistSummary = ALLOWED_IMPORTERS.map(
  ({ file, reason }) => `- ${file}: ${reason}`,
).join("\n");

describe("engine-only import invariant (ADR-0017)", () => {
  it("keeps storage internals and the graph barrel importable only inside src/graph/ and the allowlist", () => {
    const allowlist = new Set(ALLOWED_IMPORTERS.map(({ file }) => file));
    const violations: string[] = [];

    for (const scanRoot of SCAN_ROOTS) {
      for (const file of listSourceFiles(join(repoRoot, scanRoot))) {
        const repoPath = toRepoPath(file);
        if (SKIP_PREFIXES.some((prefix) => repoPath.startsWith(prefix))) continue;
        if (allowlist.has(repoPath)) continue;
        const specifiers = importsOfProtectedFile(file);
        if (specifiers.length > 0) {
          violations.push(`${repoPath} imports ${specifiers.join(", ")}`);
        }
      }
    }

    expect(
      violations,
      `Storage internals must stay inside src/graph/. Allowed exceptions:\n${allowlistSummary}`,
    ).toEqual([]);
  });
});
