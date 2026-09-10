import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  version: string;
  scripts?: Record<string, string>;
};
const releaseWorkflow = readFileSync(join(repoRoot, ".github/workflows/release.yml"), "utf8");
const ciWorkflow = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");

describe("production release gates", () => {
  it("exposes a release-note checker and evidence commands", () => {
    expect(packageJson.scripts?.["release:check-notes"]).toBe("node scripts/check-release-notes.mjs");
    expect(packageJson.scripts?.["release:preflight-evidence"]).toBe(
      "node scripts/write-release-preflight-evidence.mjs",
    );
    expect(packageJson.scripts?.["release:postcheck"]).toBe("node scripts/verify-published-release.mjs");
    expect(packageJson.scripts?.["release:evidence"]).toBe("node scripts/assemble-release-evidence.mjs");
  });

  it("pins every GitHub Action in CI and release workflows to a full commit SHA", () => {
    for (const workflow of [ciWorkflow, releaseWorkflow]) {
      const actionRefs = [...workflow.matchAll(/^\s+uses:\s+([^\s#]+)/gm)].map((match) => match[1]);
      expect(actionRefs.length).toBeGreaterThan(0);
      for (const actionRef of actionRefs) {
        expect(actionRef, `mutable action reference: ${actionRef}`).toMatch(/@[0-9a-f]{40}$/);
      }
    }
  });

  it("uses npm trusted publishing without a long-lived npm token", () => {
    expect(releaseWorkflow).toContain("id-token: write");
    expect(releaseWorkflow).toContain("npm publish");
    expect(releaseWorkflow).toContain("--provenance");
    expect(releaseWorkflow).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN|secrets\.NPM_/);
  });

  it("runs every required pre-publication gate before publish", () => {
    const publishIndex = releaseWorkflow.indexOf("npm publish");
    expect(publishIndex).toBeGreaterThan(0);
    for (const gate of [
      "release:check-notes",
      "npm run build",
      "npm run typecheck",
      "npm test",
      "npm run benchmark:corpus",
      "npm run pack:smoke",
      "npm audit",
    ]) {
      expect(releaseWorkflow.indexOf(gate)).toBeGreaterThanOrEqual(0);
      expect(releaseWorkflow.indexOf(gate)).toBeLessThan(publishIndex);
    }
    expect(releaseWorkflow).toContain("Tarball and clean-consumer gates");
  });

  it("attaches the complete release evidence bundle to the GitHub release", () => {
    expect(releaseWorkflow).toContain("path: release-evidence");
    expect(releaseWorkflow).toContain("if-no-files-found: error");
    for (const artifact of [
      "release-evidence/EVD-RELEASE.json",
      "release-evidence/EVD-RELEASE-PRE.json",
      "release-evidence/EVD-RELEASE-POST.json",
      "release-evidence/EVD-PROVENANCE.json",
      "release-evidence/RELEASE-NOTES.md",
      "release-evidence/CHANGELOG.md",
      "release-evidence/tarball-digest.sha256",
      "release-evidence/benchmark-node22/EVD-CI-PASS-node22.json",
      "release-evidence/benchmark-node22/EVD-BENCH-PASS-*.json",
      "release-evidence/benchmark-node22/EVD-BENCH-SUMMARY.json",
      "release-evidence/benchmark-node24/EVD-CI-PASS-node24.json",
      "release-evidence/benchmark-node24/EVD-BENCH-PASS-*.json",
      "release-evidence/benchmark-node24/EVD-BENCH-SUMMARY.json",
    ]) {
      expect(releaseWorkflow).toContain(artifact);
    }
  });

  it("validates the checked-in release notes for the current package", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "ariadne-release-notes-test-"));
    try {
      const outputPath = join(outputDir, "release-notes.md");
      const script = join(repoRoot, "scripts/check-release-notes.mjs");
      const releaseNotes = await import(pathToFileURL(script).href);
      const result = await releaseNotes.verifyReleaseNotes({
        version: packageJson.version,
        outputPath,
      });
      expect(result.version).toBe(packageJson.version);
      expect(readFileSync(outputPath, "utf8")).toContain("production-oriented release");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
