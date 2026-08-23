import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const srcRoot = join(repoRoot, "src");
const harnessRoot = join(srcRoot, "harness");

const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
};

describe("no Orchestration Kernel is retained", () => {
  it("keeps src/harness limited to thin-path modules: attempt, controller, self-application", async () => {
    expect((await readdir(harnessRoot)).sort()).toEqual([
      "attempt.ts",
      "controller.ts",
      "self-application.ts",
    ]);
  });

  it("exports no kernel symbol anywhere under src/", async () => {
    const files = await walk(srcRoot);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(file, "utf8");
      const declaresKernel =
        /^\s*export\s+(?:default\s+)?(?:abstract\s+)?(?:class|interface|type|enum|const|function)\s+\w*[Kk]ernel\b/m.test(
          source,
        ) || /export\s*\{[^}]*\b\w*[Kk]ernel\b[^}]*\}/m.test(source);
      expect({ file: file.slice(srcRoot.length + 1), declaresKernel }).toEqual({
        file: file.slice(srcRoot.length + 1),
        declaresKernel: false,
      });
    }
  });

  it("limits the thin attempt module to its exact declared import surface", async () => {
    const source = await readFile(join(harnessRoot, "attempt.ts"), "utf8");
    const imports = [...source.matchAll(/^import\s+[^;]*from\s+"([^"]+)";/gm)].map(
      (match) => match[1],
    );
    // Fixed allowlist: any new dependency on network, IPC, worker, lock,
    // queue, or database facilities fails here.
    const allowed = new Set(["node:fs/promises", "node:path", "../adapters/lifecycle.js"]);
    for (const specifier of imports) {
      expect({ specifier, allowed: allowed.has(specifier) }).toEqual({
        specifier,
        allowed: true,
      });
    }
    // Ceiling: textual scan cannot see dynamic import() or re-exports.
  });

  it("keeps the attempt module separate from the controller, graph storage, gates, and Epistemic Overlay", async () => {
    const attemptSource = await readFile(join(harnessRoot, "attempt.ts"), "utf8");
    for (const forbidden of ["../graph/", "../gates/", "../core/", "./controller.js"]) {
      expect(attemptSource).not.toContain(forbidden);
    }
    // And nothing in those subsystems reaches back into the attempt module.
    const outside = await walk(srcRoot);
    for (const file of outside.filter((path) => !path.startsWith(harnessRoot))) {
      const source = await readFile(file, "utf8");
      expect(source.includes("harness/attempt")).toBe(false);
    }
    const controllerSource = await readFile(join(harnessRoot, "controller.ts"), "utf8");
    expect(controllerSource).not.toContain("./attempt.js");
    expect(controllerSource).not.toContain("./attempt.ts");
  });

  it("adds no runtime dependency beyond zod", async () => {
    const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    // Key-set equality only: version bumps are not kernel infrastructure.
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["zod"]);
  });
});
