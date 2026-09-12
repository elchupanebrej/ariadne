import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

const writer = new URL("../../scripts/write-benchmark-ci-evidence.mjs", import.meta.url);
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

    execFileSync(process.execPath, [writer.pathname, "--summary", summary, "--output", output]);

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

    expect(() => execFileSync(process.execPath, [writer.pathname, "--summary", summary, "--output", output])).toThrow(/exactly one runtime/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
