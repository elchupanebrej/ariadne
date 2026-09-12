import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";


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

const node = (
  id: string,
  type: "EVD" | "ASM" | "TASK" | "CAN" | "DEC" | "UNK" | "HYP",
  provenance_type: "FACT" | "ASSUMED" | "DERIVED" | "PROPOSED" | "DECIDED" | "UNKNOWN",
) => ({
  id,
  type,
  provenance_type,
  statement: id,
  ...(type === "EVD"
    ? {
        verdict: "FALSIFIED" as const,
        method: "focused invalidation test",
        rung: 3,
        receipt: "sha256:cli-invalidation",
        stdout_digest: "sha256:cli-invalidation-stdout",
        reproducible_environment: "node-22/linux-x64",
      }
    : {}),
});

const workspace = async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-invalidate-"));
  const graph = EpistemicGraph.open(join(cwd, ".ariadne"));
  await graph.batch((batch) => {
    batch.appendEvents([
      { kind: "node", node: node("EVD-1", "EVD", "FACT") },
      { kind: "node", node: node("ASM-1", "ASM", "ASSUMED") },
      { kind: "node", node: node("TASK-1", "TASK", "DERIVED") },
      { kind: "node", node: node("CAN-1", "CAN", "PROPOSED") },
      { kind: "node", node: node("DEC-1", "DEC", "DECIDED") },
      { kind: "node", node: node("UNK-1", "UNK", "UNKNOWN") },
      { kind: "node", node: node("HYP-1", "HYP", "PROPOSED") },
      { kind: "edge", edge: { source: "EVD-1", target: "ASM-1", type: "falsifies" } },
      { kind: "edge", edge: { source: "EVD-1", target: "HYP-1", type: "falsifies" } },
      { kind: "edge", edge: { source: "TASK-1", target: "ASM-1", type: "depends_on" } },
      { kind: "edge", edge: { source: "CAN-1", target: "TASK-1", type: "derived_from" } },
      { kind: "edge", edge: { source: "DEC-1", target: "CAN-1", type: "depends_on" } },
    ]);
  });
  return { cwd, graph };
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

const parseReceipt = (output: string) =>
  JSON.parse(output.trim().split("\n").at(-1) ?? "") as {
    falsified_node_id: string;
    evidence_id: string;
    affected_node_ids: string[];
  };

describe("ariadne invalidate", () => {
  it("persists the deterministic cascade, state receipt, and index", async () => {
    const { cwd, graph } = await workspace();
    const before = await graph.readEvents();
    const result = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);

    expect(result.code).toBe(0);
    expect(result.stdout.text()).toContain("ARIADNE OPERATIONAL NOTICE");
    const output = parseReceipt(result.stdout.text());
    expect(output).toMatchObject({ falsified_node_id: "ASM-1", evidence_id: "EVD-1" });
    expect(output.affected_node_ids).toEqual(["ASM-1", "CAN-1", "DEC-1"]);

    const materialized = await graph.materialize();
    expect(materialized.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ASM-1", status: "FALSIFIED" }),
        expect.objectContaining({ id: "CAN-1", status: "INVALIDATED" }),
        expect.objectContaining({
          id: "DEC-1",
          status: "RE-OPENED",
          invalidation: expect.objectContaining({ needs_review: true }),
        }),
      ]),
    );
    expect((await graph.readEvents()).length).toBeGreaterThan(before.length);
    expect((await graph.readEvents()).filter((event) => event.kind === "node")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node: expect.objectContaining({ id: "ASM-1", status: "FALSIFIED" }) }),
      ]),
    );

    const state = (await graph.getState()) as {
      last_invalidation: {
        node_id: string;
        evidence_id: string;
        affected_node_ids: string[];
      };
    };
    expect(state.last_invalidation).toEqual({
      node_id: "ASM-1",
      evidence_id: "EVD-1",
      affected_node_ids: ["ASM-1", "CAN-1", "DEC-1"],
    });
    expect(await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8")).toContain("ASM-1");
  });

  it("writes the cascade in one transaction and repeats idempotently", async () => {
    const { cwd, graph } = await workspace();
    const invalidateSpy = vi.spyOn(EpistemicGraph.prototype, "invalidate");
    try {
      const first = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);
      expect(first.code).toBe(0);
      const afterFirst = await graph.readEvents();

      await graph.batch((batch) => batch.writeStateProjection("{}"));
      const second = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);
      expect(second.code).toBe(0);
      expect(second.stdout.text()).not.toContain("ARIADNE OPERATIONAL NOTICE");
      expect(await graph.readEvents()).toEqual(afterFirst);
      expect(await graph.getState()).toMatchObject({
        last_invalidation: {
          node_id: "ASM-1",
          evidence_id: "EVD-1",
          affected_node_ids: ["ASM-1", "CAN-1", "DEC-1"],
        },
        active_notices: [expect.stringMatching(/^NOT-/u)],
      });
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
    } finally {
      invalidateSpy.mockRestore();
    }
  });


  it("serializes concurrent invalidations without duplicating cascade events", async () => {
    const { cwd, graph } = await workspace();
    const before = await graph.readEvents();

    const [first, second] = await Promise.all([
      invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]),
      invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]),
    ]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    const after = await graph.readEvents();
    expect(after).toHaveLength(before.length + 3);
    expect(after.filter((event) => event.kind === "node")).toHaveLength(
      before.filter((event) => event.kind === "node").length + 3,
    );
    const state = (await graph.getState()) as Record<string, unknown>;
    expect(state.active_notices).toEqual([
      expect.stringMatching(/^NOT-/u),
    ]);
  });

  it("rejects missing, wrong-kind, or unlinked evidence without writing", async () => {
    const { cwd, graph } = await workspace();
    const before = await graph.readEvents();

    const missing = await invoke(cwd, ["invalidate", "ASM-404", "--by", "EVD-1"]);
    expect(missing.code).toBe(2);
    expect(missing.stderr.text()).toContain("ASM-404");

    const wrongEvidence = await invoke(cwd, ["invalidate", "ASM-1", "--by", "ASM-1"]);
    expect(wrongEvidence.code).toBe(2);
    expect(wrongEvidence.stderr.text()).toContain("EVD");

    const wrongTarget = await invoke(cwd, ["invalidate", "TASK-1", "--by", "EVD-1"]);
    expect(wrongTarget.code).toBe(2);
    expect(wrongTarget.stderr.text()).toContain("ASM or HYP");

    expect(await graph.readEvents()).toEqual(before);
  });

  it("rejects incomplete falsifying evidence without writing", async () => {
    const { cwd, graph } = await workspace();
    await graph.batch((batch) => {
      batch.appendEvents([
        {
          kind: "node",
          node: {
            id: "EVD-2",
            type: "EVD",
            provenance_type: "FACT",
            statement: "Incomplete evidence",
          },
        },
        { kind: "edge", edge: { source: "EVD-2", target: "ASM-1", type: "falsifies" } },
      ]);
    });
    const before = await graph.readEvents();

    const result = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-2"]);

    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/incomplete|verdict|method|rung|receipt|environment/i);
    expect(await graph.readEvents()).toEqual(before);
  });

  it("rejects invalidating an UNK node with diagnostic pointing explicitly to ariadne waive", async () => {
    const { cwd, graph } = await workspace();
    const before = await graph.readEvents();

    const result = await invoke(cwd, ["invalidate", "UNK-1", "--by", "EVD-1"]);

    expect(result.code).toBe(2);
    expect(result.stderr.text()).toContain("ariadne waive UNK-1 --by <decision-id>");
    expect(result.stderr.text()).toContain("ariadne waive <UNK> --by <DEC>");
    expect(await graph.readEvents()).toEqual(before);
  });

  it("rejects invalidating a DEC node with diagnostic pointing explicitly to ariadne supersede", async () => {
    const { cwd, graph } = await workspace();
    const before = await graph.readEvents();

    const result = await invoke(cwd, ["invalidate", "DEC-1", "--by", "EVD-1"]);

    expect(result.code).toBe(2);
    expect(result.stderr.text()).toContain("ariadne supersede DEC-1 --by <decision-id>");
    expect(result.stderr.text()).toContain("ariadne supersede <DEC> --by <DEC>");
    expect(await graph.readEvents()).toEqual(before);
  });

  it("accepts --by as canonical flag and --reason as legacy alias, rejecting both", async () => {
    const { cwd, graph } = await workspace();

    // Rejecting specifying both --by and --reason
    const both = await invoke(cwd, [
      "invalidate",
      "ASM-1",
      "--by",
      "EVD-1",
      "--reason",
      "EVD-1",
    ]);
    expect(both.code).toBe(2);
    expect(both.stderr.text()).toMatch(/Specify only one invalidation explanation/i);

    // Rejecting missing explanation flag
    const noExplanation = await invoke(cwd, ["invalidate", "ASM-1"]);
    expect(noExplanation.code).toBe(2);
    expect(noExplanation.stderr.text()).toContain("--by");

    // Accepts legacy --reason alias
    const withReason = await invoke(cwd, ["invalidate", "ASM-1", "--reason", "EVD-1"]);
    expect(withReason.code).toBe(0);
    expect(parseReceipt(withReason.stdout.text())).toMatchObject({
      falsified_node_id: "ASM-1",
      evidence_id: "EVD-1",
    });
  });

  it("invalidates HYP nodes matching ASM invalidation behavior", async () => {
    const { cwd, graph } = await workspace();

    const result = await invoke(cwd, ["invalidate", "HYP-1", "--by", "EVD-1"]);
    expect(result.code).toBe(0);
    const output = parseReceipt(result.stdout.text());
    expect(output).toMatchObject({ falsified_node_id: "HYP-1", evidence_id: "EVD-1" });

    const materialized = await graph.materialize();
    expect(materialized.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "HYP-1", status: "FALSIFIED" }),
      ]),
    );
  });
});

