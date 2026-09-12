import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const writer = fileURLToPath(new URL("../../scripts/write-benchmark-ci-evidence.mjs", import.meta.url));
const runtime = { platform: "linux", arch: "x64", nodeVersion: "v24.17.0", nodeMajor: 24 };

it("writes a CI receipt when a passing corpus repeats one runtime per run", () => {
  const directory = mkdtempSync(join(tmpdir(), "ariadne-ci-evidence-"));
  try {
    const summary = join(directory, "summary.json");
    const output = join(directory, "receipt.json");
    writeFileSync(summary, JSON.stringify({
      kind: "capacity-performance-summary",
      passed: true,
      runtimes: Array.from({ length: 5 }, () => runtime),
    }));

    execFileSync(process.execPath, [writer, "--summary", summary, "--output", output]);

    expect(JSON.parse(readFileSync(output, "utf8")).runtime).toEqual(runtime);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

it("fails closed when a passing summary claims multiple runtimes", () => {
  const directory = mkdtempSync(join(tmpdir(), "ariadne-ci-evidence-mixed-"));
  try {
    const summary = join(directory, "summary.json");
    const output = join(directory, "receipt.json");
    writeFileSync(summary, JSON.stringify({
      kind: "capacity-performance-summary",
      passed: true,
      runtimes: [runtime, { ...runtime, nodeVersion: "v22.23.0", nodeMajor: 22 }],
    }));

    const result = spawnSync(process.execPath, [writer, "--summary", summary, "--output", output], {
      encoding: "utf8",
      shell: false,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("benchmark summary must identify exactly one runtime");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
