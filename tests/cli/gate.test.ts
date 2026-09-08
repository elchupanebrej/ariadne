import { fileURLToPath } from "node:url";
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

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

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

  it("reports unresolved decision-scope merge contradictions separately", async () => {
    const cwd = await workspace();
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      id: "CTR-MERGE-SCOPE",
      type: "CTR",
      provenance_type: "FACT",
      statement: "Two branches disagree about one decision scope",
      status: "MERGE_CONFLICT",
      conflict_kind: "branch_merge",
      decision_scope: "release-policy",
    });

    const result = await invoke(cwd, ["gate", "decision-scope"]);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.stdout.text())).toMatchObject({
      gate: "decision-scope",
      passed: false,
      diagnostics: [
        expect.objectContaining({
          code: "DECISION_SCOPE_DIVERGENCE",
          nodeId: "CTR-MERGE-SCOPE",
        }),
      ],
      results: [{ gate: "decision-scope", passed: false }],
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

  it("preflights candidate breadth without mutating the partial graph", async () => {
    const cwd = await workspace();
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      id: "CTR-1",
      type: "CTR",
      provenance_type: "PROPOSED",
      statement: "An active contradiction",
      status: "ACTIVE",
    });

    const partial = await storage.materialize();
    const incomplete = await invoke(cwd, ["gate", "semantic"]);
    const incompleteReceipt = JSON.parse(incomplete.stdout.text()) as {
      diagnostics: Array<{
        code: string;
        requiredCandidates?: number;
        actualCandidates?: number;
        coveredPrinciples?: string[];
        uncoveredPrinciples?: string[];
      }>;
    };
    const codes = incompleteReceipt.diagnostics.map((diagnostic) => diagnostic.code);
    expect(incomplete.code).toBe(1);
    expect(codes.indexOf("CTR_SEPARATION_PREFLIGHT")).toBeLessThan(
      codes.indexOf("CTR_SEPARATION_DIVERSITY"),
    );
    expect(incompleteReceipt.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CTR_SEPARATION_PREFLIGHT",
          requiredCandidates: 3,
          actualCandidates: 0,
          coveredPrinciples: [],
          uncoveredPrinciples: expect.arrayContaining([
            "Operating Condition",
            "State/Data",
            "System Boundary",
            "Time",
          ]),
        }),
      ]),
    );
    expect(await storage.materialize()).toEqual(partial);

    await storage.appendNode({
      id: "CAN-1",
      type: "CAN",
      provenance_type: "PROPOSED",
      statement: "CAN-1",
      contradiction_ref: "CTR-1",
      separation_principle: ["operating condition", "time", "system boundary"],
    });

    const oneCandidate = await invoke(cwd, ["gate", "semantic"]);
    const oneCandidateReceipt = JSON.parse(oneCandidate.stdout.text()) as {
      diagnostics: Array<{
        code: string;
        requiredCandidates?: number;
        actualCandidates?: number;
        additionalCandidatesNeeded?: number;
        coveredPrinciples?: string[];
      }>;
    };
    expect(oneCandidate.code).toBe(1);
    expect(oneCandidateReceipt.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "CTR_SEPARATION_PREFLIGHT",
          requiredCandidates: 3,
          actualCandidates: 1,
          additionalCandidatesNeeded: 2,
          coveredPrinciples: expect.arrayContaining([
            "operating condition",
            "system boundary",
            "time",
          ]),
        }),
        expect.objectContaining({
          code: "CTR_CANDIDATE_CARDINALITY",
        }),
      ]),
    );

    for (const [id, separationPrinciple] of [
      ["CAN-2", "state/data"],
      ["CAN-3", "system boundary"],
    ]) {
      await storage.appendNode({
        id,
        type: "CAN",
        provenance_type: "PROPOSED",
        statement: id,
        contradiction_ref: "CTR-1",
        separation_principle: separationPrinciple,
      });
    }

    const complete = await invoke(cwd, ["gate", "semantic"]);
    expect(complete.code).toBe(0);
    expect(JSON.parse(complete.stdout.text())).toMatchObject({
      passed: true,
      diagnostics: [],
      results: [{ gate: "semantic", passed: true, diagnostics: [] }],
    });
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
    expect(invalid.code).toBe(2);
    expect(invalid.stderr.text()).toContain("Unknown gate");
  });

  it("gates the committed repo overlay strict-green", async () => {
    const result = await invoke(repoRoot, ["gate", "all", "--strict"]);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.text())).toMatchObject({
      gate: "all",
      strict: true,
      passed: true,
      diagnostics: [],
      results: [
        { gate: "structural", passed: true, diagnostics: [] },
        { gate: "semantic", passed: true, diagnostics: [] },
        { gate: "epistemic", passed: true, diagnostics: [] },
      ],
    });
  });
});
