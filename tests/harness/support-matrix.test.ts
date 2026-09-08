import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const matrixPath = join(
  repoRoot,
  ".scratch/methodological-harness-system-implementation/evidence/17-clean-session-support-matrix.md",
);

describe("clean-session support matrix", () => {
  it("cites only test files that exist", async () => {
    const matrix = await readFile(matrixPath, "utf8");
    const cited = [...matrix.matchAll(/`((?:tests|src)\/[^`]+\.ts)`/g)]
      .map((match) => match[1])
      .filter((p) => !p.includes("teach-harness") && !p.includes("teach-methodology"));
    expect(cited.length).toBeGreaterThan(5);
    for (const relative of cited) {
      await expect(access(join(repoRoot, relative))).resolves.toBeUndefined();
    }
  });

  it("uses the three-way verdict vocabulary with no averaging", async () => {
    const matrix = (await readFile(matrixPath, "utf8")).toLowerCase();
    expect(matrix).toContain("supported / falsified / inconclusive");
    expect(matrix).toContain("| supported |");
    expect(matrix).not.toMatch(/overall[:\s]*(pass|fail)/);
    expect(matrix).not.toMatch(/weighted|averaged score/);
  });

  it("covers every teaching skill and the kernel in deletion-rule outcomes", async () => {
    const matrix = await readFile(matrixPath, "utf8");
    for (const layer of [
      "Orchestration Kernel",
      "Thin attempt module",
      "Teaching Skills",
      "Ariadne Harness Controller",
      "Release bundle registry",
    ]) {
      expect(matrix).toContain(layer);
    }
    expect(matrix).toContain("deleted / never created");
  });

  it("keeps rung ceilings explicit and wider claims unadvertised", async () => {
    const matrix = await readFile(matrixPath, "utf8");
    expect(matrix).toContain("Rung 5 mutation evidence: **not achieved**");
    expect(matrix).toContain("**no claim made**");
    expect(matrix).toContain("unadvertised");
    expect(matrix).toMatch(/Rung 8 production safety/i);
  });
});
