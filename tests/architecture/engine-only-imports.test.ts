import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const PROTECTED_FILES = ["src/graph/storage.ts", "src/graph/storage-driver.ts"];

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

const SCAN_ROOTS = ["src", "tests"];

const toRepoPath = (absolutePath: string): string =>
  relative(repoRoot, absolutePath).replaceAll("\\", "/");

const listTypeScriptFiles = (directory: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listTypeScriptFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
};

const importSpecifierPattern = /(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;

const importsOfProtectedFile = (file: string): string[] => {
  const specifiers: string[] = [];
  for (const match of readFileSync(file, "utf8").matchAll(importSpecifierPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const resolved = toRepoPath(resolve(join(file, ".."), specifier));
    const canonical = resolved.endsWith(".js") ? `${resolved.slice(0, -3)}.ts` : resolved;
    if (PROTECTED_FILES.includes(canonical)) specifiers.push(specifier);
  }
  return specifiers;
};

describe("engine-only import invariant (ADR-0017)", () => {
  it("keeps storage internals importable only inside the graph package and the allowlist", () => {
    const allowlist = new Set(ALLOWED_IMPORTERS.map(({ file }) => file));
    const violations: string[] = [];

    for (const scanRoot of SCAN_ROOTS) {
      for (const file of listTypeScriptFiles(join(repoRoot, scanRoot))) {
        const repoPath = toRepoPath(file);
        if (repoPath.startsWith("src/graph/")) continue;
        if (allowlist.has(repoPath)) continue;
        const specifiers = importsOfProtectedFile(file);
        if (specifiers.length > 0) {
          violations.push(`${repoPath} imports ${specifiers.join(", ")}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
