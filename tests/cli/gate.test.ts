import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage } from "../../src/graph/storage.js";

const capture = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  return { stream, text: () => output };
};

const invoke = (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  return runCli(args, { cwd, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    stdout,
    stderr,
  }));
};

const workspace = async () => mkdtemp(join(tmpdir(), "ariadne-cli-gate-"));

describe("ariadne gate", () => {
  it("runs a selected gate and returns a passing JSON receipt", async () => {
    const cwd = await workspace();
    const result = await invoke(cwd, ["gate", "structural"]);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.text())).toEqual({
      gate: "structural",
      strict: false,
      passed: true,
      diagnostics: [],
      results: [
        { gate: "structural", passed: true, diagnostics: [] },
      ],
    });
  });

  it("accepts --strict and reports remediation for violations", async () => {
    const cwd = await workspace();
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      id: "HYP-1",
      type: "HYP",
      provenance_type: "PROPOSED",
      statement: "A hypothesis without a falsification condition",
    });

    const result = await invoke(cwd, ["gate", "semantic", "--strict"]);
    const receipt = JSON.parse(result.stdout.text()) as {
      gate: string;
      strict: boolean;
      passed: boolean;
      diagnostics: Array<{ code: string; remediation: string }>;
    };

    expect(result.code).toBe(1);
    expect(receipt.gate).toBe("semantic");
    expect(receipt.strict).toBe(true);
    expect(receipt.passed).toBe(false);
    expect(receipt.diagnostics).toEqual([
      expect.objectContaining({
        code: "HYP_FALSIFICATION_CONDITION",
        remediation: expect.any(String),
      }),
    ]);
  });

  it("runs all gates in deterministic order and rejects an invalid command", async () => {
    const cwd = await workspace();
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      id: "HYP-1",
      type: "HYP",
      provenance_type: "PROPOSED",
      statement: "A hypothesis without a falsification condition",
    });

    const all = await invoke(cwd, ["gate", "all"]);
    const receipt = JSON.parse(all.stdout.text()) as {
      passed: boolean;
      diagnostics: Array<{ gate: string; remediation: string }>;
      results: Array<{ gate: string; passed: boolean }>;
    };
    expect(all.code).toBe(1);
    expect(receipt.passed).toBe(false);
    expect(receipt.results.map((entry) => entry.gate)).toEqual([
      "structural",
      "semantic",
      "epistemic",
    ]);
    expect(receipt.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gate: "semantic",
          remediation: expect.any(String),
        }),
      ]),
    );

    const invalid = await invoke(cwd, ["gate", "unknown"]);
    expect(invalid.code).toBe(1);
    expect(invalid.stderr.text()).toContain("Unknown gate");
  });
});
