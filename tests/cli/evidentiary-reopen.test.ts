import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage } from "../../src/graph/storage.js";
import type { NodeType, ProvenanceType } from "../../src/core/types/nodes.js";

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
  type: NodeType,
  provenance_type: ProvenanceType,
  extra: Record<string, unknown> = {},
) => ({
  id,
  type,
  provenance_type,
  statement: `Statement for ${id}`,
  ...(type === "EVD"
    ? {
        verdict: "FALSIFIED" as const,
        method: "evidentiary reopen test",
        rung: 3,
        receipt: "sha256:cli-evidentiary-reopen",
        stdout_digest: "sha256:cli-evidentiary-reopen-stdout",
        reproducible_environment: "node-22/linux-x64",
      }
    : {}),
  ...extra,
});

const workspace = async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-evidentiary-reopen-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  for (const item of [
    node("EVD-1", "EVD", "FACT"),
    node("ASM-1", "ASM", "ASSUMED"),
    node("TASK-1", "TASK", "DERIVED"),
    node("CAN-1", "CAN", "PROPOSED"),
    node("DEC-1", "DEC", "DECIDED"),
    node("UNK-1", "UNK", "UNKNOWN"),
    node("DEC-2", "DEC", "DECIDED"),
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
    trace: Array<{
      node_id: string;
      status?: string;
      previous_status?: string;
      relation?: string;
    }>;
  };

describe("evidentiary re-open cascade", () => {
  it("re-opens waived unknowns and superseded decisions in the same transaction upon falsification", async () => {
    const { cwd, storage } = await workspace();

    // 1. Waive UNK-1 by DEC-1
    const waiveResult = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(waiveResult.code).toBe(0);

    // 2. Supersede DEC-2 by DEC-1
    const supersedeResult = await invoke(cwd, ["supersede", "DEC-2", "--by", "DEC-1"]);
    expect(supersedeResult.code).toBe(0);

    // Verify both are terminal and not on the frontier
    const stateBefore = (await storage.readState<Record<string, unknown>>()) ?? {};
    const frontierBefore = (stateBefore.frontier as string[]) ?? [];
    const openUnknownsBefore = (stateBefore.open_unknowns as string[]) ?? [];
    expect(frontierBefore).not.toContain("UNK-1");
    expect(frontierBefore).not.toContain("DEC-2");
    expect(openUnknownsBefore).not.toContain("UNK-1");

    const indexBefore = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");
    expect(indexBefore).not.toMatch(/\|\s*UNK-1\s*\|/);
    expect(indexBefore).not.toMatch(/\|\s*DEC-2\s*\|/);

    const eventsBefore = await storage.readEvents();

    // 3. Falsify ASM-1 by EVD-1
    const invalidateResult = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);
    expect(invalidateResult.code).toBe(0);

    const receipt = parseReceipt(invalidateResult.stdout.text());
    expect(receipt).toMatchObject({
      falsified_node_id: "ASM-1",
      evidence_id: "EVD-1",
    });

    // UNK-1 and DEC-2 appear in affected_node_ids
    expect(receipt.affected_node_ids).toEqual(
      expect.arrayContaining(["ASM-1", "CAN-1", "DEC-1", "DEC-2", "UNK-1"]),
    );

    // Invalidation trace contains UNK-1 (waived_by) and DEC-2 (superseded_by)
    expect(receipt.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: "DEC-1",
          status: "RE-OPENED",
        }),
        expect.objectContaining({
          node_id: "UNK-1",
          status: "RE-OPENED",
          previous_status: "WAIVED",
          relation: "waived_by",
        }),
        expect.objectContaining({
          node_id: "DEC-2",
          status: "RE-OPENED",
          previous_status: "SUPERSEDED",
          relation: "superseded_by",
        }),
      ]),
    );

    // Graph materialized nodes check
    const graph = await storage.materialize();
    const dec1 = graph.nodes.find((n) => n.id === "DEC-1");
    const unk1 = graph.nodes.find((n) => n.id === "UNK-1");
    const dec2 = graph.nodes.find((n) => n.id === "DEC-2");

    expect(dec1?.status).toBe("RE-OPENED");
    expect(unk1?.status).toBe("RE-OPENED");
    expect(dec2?.status).toBe("RE-OPENED");

    expect(unk1?.invalidation).toMatchObject({
      evidence_id: "EVD-1",
      previous_status: "WAIVED",
      status: "RE-OPENED",
      reopened_by_decision: "DEC-1",
    });
    expect(dec2?.invalidation).toMatchObject({
      evidence_id: "EVD-1",
      previous_status: "SUPERSEDED",
      status: "RE-OPENED",
      reopened_by_decision: "DEC-1",
    });

    // STATE.yaml has UNK-1 and DEC-2 on active frontier, and UNK-1 in open_unknowns
    const stateAfter = (await storage.readState<Record<string, unknown>>()) ?? {};
    const frontierAfter = (stateAfter.frontier as string[]) ?? [];
    const openUnknownsAfter = (stateAfter.open_unknowns as string[]) ?? [];
    expect(frontierAfter).toContain("DEC-1");
    expect(frontierAfter).toContain("UNK-1");
    expect(frontierAfter).toContain("DEC-2");
    expect(openUnknownsAfter).toContain("UNK-1");

    // INDEX.md frontier table contains UNK-1 and DEC-2
    const indexAfter = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");
    expect(indexAfter).toMatch(/\|\s*UNK-1\s*\|\s*UNKNOWN\s*\|\s*RE-OPENED\s*\|/);
    expect(indexAfter).toMatch(/\|\s*DEC-2\s*\|\s*DECIDED\s*\|\s*RE-OPENED\s*\|/);

    // Card files updated with status RE-OPENED
    const unk1Card = await readFile(join(cwd, ".ariadne", "cards", "UNK-1.md"), "utf8");
    expect(unk1Card).toContain("- Status: RE-OPENED");
    expect(unk1Card).toContain("waived_by");
    expect(unk1Card).toContain("DEC-1");

    const dec2Card = await readFile(join(cwd, ".ariadne", "cards", "DEC-2.md"), "utf8");
    expect(dec2Card).toContain("- Status: RE-OPENED");
    expect(dec2Card).toContain("superseded_by");
    expect(dec2Card).toContain("DEC-1");

    // Events were appended atomically
    const eventsAfter = await storage.readEvents();
    expect(eventsAfter.length).toBeGreaterThan(eventsBefore.length);
    expect(
      eventsAfter.some((e) => e.kind === "node" && e.node.id === "UNK-1" && e.node.status === "RE-OPENED"),
    ).toBe(true);
    expect(
      eventsAfter.some((e) => e.kind === "node" && e.node.id === "DEC-2" && e.node.status === "RE-OPENED"),
    ).toBe(true);

    // Idempotent re-run
    const repeatResult = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);
    expect(repeatResult.code).toBe(0);
    expect(await storage.readEvents()).toEqual(eventsAfter);
  });

  it("routine supersession by a live decision does NOT unwind closed nodes", async () => {
    const { cwd, storage } = await workspace();

    // Setup: DEC-3 live decision
    await storage.appendNode(node("DEC-3", "DEC", "DECIDED"));

    // DEC-1 waives UNK-1 and supersedes DEC-2
    await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    await invoke(cwd, ["supersede", "DEC-2", "--by", "DEC-1"]);

    // Now supersede DEC-1 by live decision DEC-3
    const supersedeResult = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-3"]);
    expect(supersedeResult.code).toBe(0);

    // Verify DEC-1 is SUPERSEDED, but UNK-1 stays WAIVED and DEC-2 stays SUPERSEDED
    const graph = await storage.materialize();
    const dec1 = graph.nodes.find((n) => n.id === "DEC-1");
    const unk1 = graph.nodes.find((n) => n.id === "UNK-1");
    const dec2 = graph.nodes.find((n) => n.id === "DEC-2");

    expect(dec1?.status).toBe("SUPERSEDED");
    expect(unk1?.status).toBe("WAIVED");
    expect(dec2?.status).toBe("SUPERSEDED");

    const state = (await storage.readState<Record<string, unknown>>()) ?? {};
    const frontier = (state.frontier as string[]) ?? [];
    expect(frontier).not.toContain("UNK-1");
    expect(frontier).not.toContain("DEC-2");
    expect(frontier).not.toContain("DEC-1");
  });

  it("handles transitive evidentiary re-open chains", async () => {
    const { cwd, storage } = await workspace();

    // Setup transitive chain:
    // DEC-1 supersedes DEC-2
    // DEC-2 supersedes DEC-3
    // DEC-3 waives UNK-2
    // DEC-2 waives UNK-1 (re-waived or separate UNK-3)
    await storage.appendNode(node("DEC-3", "DEC", "DECIDED"));
    await storage.appendNode(node("UNK-2", "UNK", "UNKNOWN"));
    await storage.appendNode(node("UNK-3", "UNK", "UNKNOWN"));

    await invoke(cwd, ["waive", "UNK-3", "--by", "DEC-3"]);
    await invoke(cwd, ["waive", "UNK-2", "--by", "DEC-2"]);
    await invoke(cwd, ["supersede", "DEC-3", "--by", "DEC-2"]);
    await invoke(cwd, ["supersede", "DEC-2", "--by", "DEC-1"]);

    // Invalidate ASM-1
    const invalidateResult = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);
    expect(invalidateResult.code).toBe(0);

    const receipt = parseReceipt(invalidateResult.stdout.text());
    expect(receipt.affected_node_ids).toEqual(
      expect.arrayContaining(["DEC-1", "DEC-2", "DEC-3", "UNK-2", "UNK-3"]),
    );

    const graph = await storage.materialize();
    expect(graph.nodes.find((n) => n.id === "DEC-1")?.status).toBe("RE-OPENED");
    expect(graph.nodes.find((n) => n.id === "DEC-2")?.status).toBe("RE-OPENED");
    expect(graph.nodes.find((n) => n.id === "DEC-3")?.status).toBe("RE-OPENED");
    expect(graph.nodes.find((n) => n.id === "UNK-2")?.status).toBe("RE-OPENED");
    expect(graph.nodes.find((n) => n.id === "UNK-3")?.status).toBe("RE-OPENED");

    const state = (await storage.readState<Record<string, unknown>>()) ?? {};
    const frontier = (state.frontier as string[]) ?? [];
    const openUnknowns = (state.open_unknowns as string[]) ?? [];

    expect(frontier).toContain("DEC-1");
    expect(frontier).toContain("DEC-2");
    expect(frontier).toContain("DEC-3");
    expect(frontier).toContain("UNK-2");
    expect(frontier).toContain("UNK-3");

    expect(openUnknowns).toContain("UNK-2");
    expect(openUnknowns).toContain("UNK-3");
  });
});
