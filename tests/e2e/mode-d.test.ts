import { readFile, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const builtCli = resolve(fileURLToPath(new URL("../../dist/cli/index.js", import.meta.url)));

type ProcessResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

const invoke = (cwd: string, args: string[]): ProcessResult => {
  const result = spawnSync(process.execPath, [builtCli, ...args], {
    cwd,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

const expectSuccess = (result: ProcessResult): ProcessResult => {
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  return result;
};

const parseLastJson = (output: string) => JSON.parse(output.trim().split("\n").at(-1) ?? "");

const addNode = (
  cwd: string,
  type: string,
  id: string,
  title: string,
  payload: Record<string, unknown>,
) =>
  expectSuccess(
    invoke(cwd, [
      "node",
      "add",
      type,
      id,
      "--title",
      title,
      "--payload",
      JSON.stringify(payload),
    ]),
  );

describe("standalone Mode D recovery", () => {
  it(
    "recovers the complete graph lifecycle across fresh CLI processes",
    async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-mode-d-"));

    const initialized = expectSuccess(invoke(cwd, ["init"]));
    expect(JSON.parse(initialized.stdout)).toMatchObject({ mode: "standalone" });

    const evidence = addNode(cwd, "EVD", "EVD-1", "Measured falsifying evidence", {
      provenance_type: "FACT",
      verdict: "FALSIFIED",
      method: "focused mode-d test",
      rung: 8,
      receipt: "sha256:mode-d",
      stdout_digest: "sha256:mode-d-stdout",
      reproducible_environment: "node-22/linux-x64",
    });
    expect(JSON.parse(evidence.stdout)).toMatchObject({ id: "EVD-1", type: "EVD" });

    const assumption = addNode(cwd, "ASM", "ASM-1", "Assumed premise", {
      provenance_type: "ASSUMED",
    });
    expect(JSON.parse(assumption.stdout)).toMatchObject({ id: "ASM-1", type: "ASM" });

    const candidate = addNode(cwd, "CAN", "CAN-1", "Candidate mechanism", {
      provenance_type: "PROPOSED",
    });
    expect(JSON.parse(candidate.stdout)).toMatchObject({ id: "CAN-1", type: "CAN" });

    expectSuccess(invoke(cwd, ["edge", "add", "EVD-1", "falsifies", "ASM-1"]));
    expectSuccess(invoke(cwd, ["edge", "add", "CAN-1", "depends_on", "ASM-1"]));

    const invalidated = expectSuccess(invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]));
    expect(invalidated.stdout).toContain("ARIADNE OPERATIONAL NOTICE");
    expect(parseLastJson(invalidated.stdout)).toMatchObject({
      falsified_node_id: "ASM-1",
      evidence_id: "EVD-1",
      affected_node_ids: ["ASM-1", "CAN-1"],
    });

    const gates = invoke(cwd, ["gate", "all"]);
    expect(gates.status).toBe(1);
    expect(gates.stderr).toBe("");
    const gateReceipt = JSON.parse(gates.stdout) as {
      passed: boolean;
      results: Array<{ gate: string; passed: boolean }>;
    };
    expect(gateReceipt.passed).toBe(false);
    expect(gateReceipt.results).toEqual([
      expect.objectContaining({ gate: "structural", passed: true }),
      expect.objectContaining({ gate: "semantic", passed: true }),
      expect.objectContaining({ gate: "epistemic", passed: false }),
    ]);

    const status = expectSuccess(invoke(cwd, ["status", "--json"]));
    expect(JSON.parse(status.stdout)).toMatchObject({
      depth_mode: "Standard",
      frontier: ["ASM-1", "EVD-1"],
      open_unknowns: [],
      graph_health: { healthy: true, nodes: 3, edges: 2 },
    });

    const storageRoot = join(cwd, ".ariadne");
    const events = (await readFile(join(storageRoot, "GRAPH.jsonl"), "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { kind: string; node?: { id: string; status?: string } });
    expect(events).toHaveLength(7);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "node", node: expect.objectContaining({ id: "ASM-1", status: "FALSIFIED" }) }),
        expect.objectContaining({ kind: "node", node: expect.objectContaining({ id: "CAN-1", status: "INVALIDATED" }) }),
      ]),
    );

    const state = JSON.parse(await readFile(join(storageRoot, "STATE.yaml"), "utf8")) as {
      last_invalidation: { node_id: string; evidence_id: string; affected_node_ids: string[] };
    };
    expect(state.last_invalidation).toEqual({
      node_id: "ASM-1",
      evidence_id: "EVD-1",
      affected_node_ids: ["ASM-1", "CAN-1"],
    });
    expect(await readFile(join(storageRoot, "INDEX.md"), "utf8")).toContain("ASM-1");
  }, 180_000);
});
