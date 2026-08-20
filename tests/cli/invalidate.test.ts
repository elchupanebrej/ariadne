import { mkdtemp, readFile } from "node:fs/promises";
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

const node = (
  id: string,
  type: "EVD" | "ASM" | "TASK" | "CAN" | "DEC",
  provenance_type: "FACT" | "ASSUMED" | "DERIVED" | "PROPOSED" | "DECIDED",
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
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  for (const item of [
    node("EVD-1", "EVD", "FACT"),
    node("ASM-1", "ASM", "ASSUMED"),
    node("TASK-1", "TASK", "DERIVED"),
    node("CAN-1", "CAN", "PROPOSED"),
    node("DEC-1", "DEC", "DECIDED"),
  ]) {
    await storage.appendNode(item);
  }
  await storage.appendEdge({ source: "EVD-1", target: "ASM-1", type: "falsifies" });
  await storage.appendEdge({ source: "TASK-1", target: "ASM-1", type: "depends_on" });
  await storage.appendEdge({ source: "CAN-1", target: "TASK-1", type: "derived_from" });
  await storage.appendEdge({ source: "DEC-1", target: "CAN-1", type: "depends_on" });
  return { cwd, storage };
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
    const { cwd, storage } = await workspace();
    const before = await storage.readEvents();
    const result = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);

    expect(result.code).toBe(0);
    expect(result.stdout.text()).toContain("ARIADNE OPERATIONAL NOTICE");
    const output = parseReceipt(result.stdout.text());
    expect(output).toMatchObject({ falsified_node_id: "ASM-1", evidence_id: "EVD-1" });
    expect(output.affected_node_ids).toEqual(["ASM-1", "CAN-1", "DEC-1"]);

    const graph = await storage.materialize();
    expect(graph.nodes).toEqual(
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
    expect((await storage.readEvents()).length).toBeGreaterThan(before.length);
    expect((await storage.readEvents()).filter((event) => event.kind === "node")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ node: expect.objectContaining({ id: "ASM-1", status: "FALSIFIED" }) }),
      ]),
    );

    const state = (await storage.readState()) as {
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

  it("rejects missing, wrong-kind, or unlinked evidence without writing", async () => {
    const { cwd, storage } = await workspace();
    const before = await storage.readEvents();

    const missing = await invoke(cwd, ["invalidate", "ASM-404", "--by", "EVD-1"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr.text()).toContain("ASM-404");

    const wrongEvidence = await invoke(cwd, ["invalidate", "ASM-1", "--by", "ASM-1"]);
    expect(wrongEvidence.code).toBe(1);
    expect(wrongEvidence.stderr.text()).toContain("EVD");

    const wrongTarget = await invoke(cwd, ["invalidate", "TASK-1", "--by", "EVD-1"]);
    expect(wrongTarget.code).toBe(1);
    expect(wrongTarget.stderr.text()).toContain("ASM or HYP");

    expect(await storage.readEvents()).toEqual(before);
  });

  it("rejects incomplete falsifying evidence without writing", async () => {
    const { cwd, storage } = await workspace();
    await storage.appendNode({
      id: "EVD-2",
      type: "EVD",
      provenance_type: "FACT",
      statement: "Incomplete evidence",
    });
    await storage.appendEdge({ source: "EVD-2", target: "ASM-1", type: "falsifies" });
    const before = await storage.readEvents();

    const result = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-2"]);

    expect(result.code).toBe(1);
    expect(result.stderr.text()).toMatch(/incomplete|verdict|method|rung|receipt|environment/i);
    expect(await storage.readEvents()).toEqual(before);
  });
});
