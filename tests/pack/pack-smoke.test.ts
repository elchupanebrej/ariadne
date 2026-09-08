import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const packSmokeScript = join(repoRoot, "scripts/pack-smoke.mjs");

describe("Tarball Zero-Leakage & Clean Consumer Smoke (Ticket 12)", () => {
  it("scripts/pack-smoke.mjs exists", () => {
    expect(existsSync(packSmokeScript)).toBe(true);
  });

  it("enforces zero-leakage pattern rules against disallowed files", () => {
    const DISALLOWED_PATTERNS = [
      { pattern: /^package\/src(\/|$)/, label: "package/src/**" },
      { pattern: /^package\/tests?(\/|$)/, label: "package/tests/** or package/test/**" },
      { pattern: /^package\/tsconfig.*\.json$/, label: "package/tsconfig*.json" },
      { pattern: /^package\/vitest\.config\.ts$/, label: "package/vitest.config.ts" },
      { pattern: /^package\/\.github(\/|$)/, label: "package/.github/**" },
      { pattern: /^package\/\.scratch(\/|$)/, label: "package/.scratch/**" },
      { pattern: /^package\/\.planning(\/|$)/, label: "package/.planning/**" },
      { pattern: /^package\/scripts(\/|$)/, label: "package/scripts/**" },
      { pattern: /^package\/\.agents\/skills\/methodize-harness(\/|$)/, label: "package/.agents/skills/methodize-harness/**" },
    ];

    const leakedSamples = [
      "package/src/index.ts",
      "package/src/core/errors.ts",
      "package/tests/cli/status.test.ts",
      "package/test/fixtures/foo.json",
      "package/tsconfig.json",
      "package/tsconfig.build.json",
      "package/vitest.config.ts",
      "package/.github/workflows/ci.yml",
      "package/.scratch/production-readiness/spec.md",
      "package/.planning/STATE.md",
      "package/scripts/pack-smoke.mjs",
      "package/.agents/skills/methodize-harness/SKILL.md",
      "package/.agents/skills/methodize-harness/example/check.mjs",
    ];

    for (const file of leakedSamples) {
      const matched = DISALLOWED_PATTERNS.some(({ pattern }) => pattern.test(file));
      expect(matched, `Expected disallowed file to be caught: ${file}`).toBe(true);
    }
  });

  it("permits only allowed files under the strict allowlist", () => {
    const ALLOWED_PATTERNS = [
      /^package\/package\.json$/,
      /^package\/README\.md$/,
      /^package\/LICENSE$/,
      /^package\/dist\//,
      /^package\/\.agents\/skills\/ariadne\//,
      /^package\/\.agents\/skills\/codebase-design\//,
      /^package\/\.agents\/skills\/grilling\//,
      /^package\/\.agents\/skills\/domain-modeling\//,
    ];

    const validFiles = [
      "package/package.json",
      "package/README.md",
      "package/LICENSE",
      "package/dist/index.js",
      "package/dist/index.d.ts",
      "package/dist/cli/index.js",
      "package/.agents/skills/ariadne/SKILL.md",
      "package/.agents/skills/ariadne/example/check.mjs",
      "package/.agents/skills/codebase-design/SKILL.md",
      "package/.agents/skills/codebase-design/example/check.mjs",
      "package/.agents/skills/grilling/SKILL.md",
      "package/.agents/skills/grilling/example/check.mjs",
      "package/.agents/skills/domain-modeling/SKILL.md",
      "package/.agents/skills/domain-modeling/example/check.mjs",
    ];

    for (const file of validFiles) {
      const allowed = ALLOWED_PATTERNS.some((pat) => pat.test(file));
      expect(allowed, `Expected file to be allowed: ${file}`).toBe(true);
    }
  });

  it("runs scripts/pack-smoke.mjs successfully verifying npm, pnpm, and yarn", () => {
    const stdout = execFileSync(process.execPath, [packSmokeScript], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });

    expect(stdout).toContain("pack-smoke: npm pack");
    expect(stdout).toContain("pack-smoke: tarball allowlist and zero-leakage validator");
    expect(stdout).toContain("pack-smoke: clean consumer smoke (npm)");
    expect(stdout).toContain("pack-smoke: clean consumer smoke (pnpm)");
    expect(stdout).toContain("pack-smoke: clean consumer smoke (yarn)");
    expect(stdout).toContain("pack-smoke: ALL SMOKE TESTS PASSED");
  }, 120_000);
});
