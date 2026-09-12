import { mkdtemp, readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
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
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type,
    statement: `Statement for ${id}`,
    ...extra,
  });

const workspace = async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-waive-"));
  const graph = EpistemicGraph.open(join(cwd, ".ariadne"));
  await graph.batch((batch) => {
    batch.appendEvents([
      { kind: "node", node: node("UNK-1", "UNK", "UNKNOWN") },
      { kind: "node", node: node("UNK-2", "UNK", "UNKNOWN") },
      { kind: "node", node: node("DEC-1", "DEC", "DECIDED") },
      { kind: "node", node: node("DEC-2", "DEC", "DECIDED") },
      {
        kind: "node",
        node: node("DEC-SUPERSEDED", "DEC", "DECIDED", { status: "SUPERSEDED" }),
      },
      {
        kind: "node",
        node: node("DEC-REOPENED", "DEC", "DECIDED", { status: "RE-OPENED" }),
      },
      { kind: "node", node: node("ASM-1", "ASM", "ASSUMED") },
      { kind: "node", node: node("EVD-1", "EVD", "FACT") },
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

describe("ariadne waive", () => {
  it("waives an unknown by a decision, updating graph, state, card, and index", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);

    expect(result.code).toBe(0);
    expect(result.stderr.text()).toBe("");
    const receipt = JSON.parse(result.stdout.text().trim()) as {
      node_id: string;
      waived_by: string;
      status: string;
    };
    expect(receipt).toMatchObject({
      node_id: "UNK-1",
      waived_by: "DEC-1",
      status: "WAIVED",
    });

    const materialized = await graph.materialize();
    const unk = materialized.nodes.find((n) => n.id === "UNK-1");
    expect(unk).toBeDefined();
    expect(unk).toMatchObject({
      id: "UNK-1",
      status: "WAIVED",
      waived_by: "DEC-1",
    });

    const events = await graph.readEvents();
    expect(events.length).toBe(beforeEvents.length + 1);
    const waiveEvent = events.find(
      (e) => e.kind === "node" && e.node.id === "UNK-1" && e.node.status === "WAIVED",
    );
    expect(waiveEvent).toBeDefined();
    expect((waiveEvent as { node: { waived_by?: string } }).node.waived_by).toBe("DEC-1");

    const state = await graph.getState();
    expect(state?.frontier).not.toContain("UNK-1");
    expect(state?.open_unknowns).not.toContain("UNK-1");
    expect(state?.frontier).toContain("UNK-2");
    expect(state?.open_unknowns).toContain("UNK-2");

    const statusResult = await invoke(cwd, ["status", "--format", "json"]);
    expect(statusResult.code).toBe(0);
    const statusJson = JSON.parse(statusResult.stdout.text()) as {
      frontier: string[];
      open_unknowns: string[];
    };
    expect(statusJson.frontier).not.toContain("UNK-1");
    expect(statusJson.open_unknowns).not.toContain("UNK-1");

    const card = await readFile(join(cwd, ".ariadne", "cards", "UNK-1.md"), "utf8");
    expect(card).toContain("- Status: WAIVED");
    expect(card).toContain("waived_by");
    expect(card).toContain("DEC-1");

    const index = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");
    expect(index).not.toMatch(/\|\s*UNK-1\s*\|/);
  });

  it("is idempotent when re-running the exact same waive command", async () => {
    const { cwd, graph } = await workspace();

    const first = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await graph.readEvents();

    const second = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(second.code).toBe(0);
    const eventsAfterSecond = await graph.readEvents();

    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
    expect(eventsAfterSecond).toEqual(eventsAfterFirst);
  });

  it("fails with a conflict error if a different closer is supplied for an already-waived node", async () => {
    const { cwd, graph } = await workspace();

    const first = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await graph.readEvents();

    const second = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-2"]);
    expect(second.code).toBe(2);
    expect(second.stderr.text()).toMatch(/conflict/i);

    const eventsAfterSecond = await graph.readEvents();
    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
  });

  it("rejects waiving a non-UNK node with a clear validation error", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "ASM-1", "--by", "DEC-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/UNK/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent target node with a clear error", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-NONEXISTENT", "--by", "DEC-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a non-DEC node for --by with a clear validation error", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "EVD-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/DEC/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent node for --by with a clear validation error", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-NONEXISTENT"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a SUPERSEDED or RE-OPENED decision for --by with a liveness guard error", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const superseded = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-SUPERSEDED"]);
    expect(superseded.code).toBe(2);
    expect(superseded.stderr.text()).toMatch(/live|SUPERSEDED/i);

    const reopened = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-REOPENED"]);
    expect(reopened.code).toBe(2);
    expect(reopened.stderr.text()).toMatch(/live|RE-OPENED/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("rejects self-reference when the target unknown itself is supplied as --by", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "UNK-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/self-reference/i);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("serializes concurrent waive operations under storage lock", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const [first, second] = await Promise.all([
      invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]),
      invoke(cwd, ["waive", "UNK-2", "--by", "DEC-1"]),
    ]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);

    const events = await graph.readEvents();
    expect(events.length).toBe(beforeEvents.length + 2);

    const materialized = await graph.materialize();
    expect(materialized.nodes.find((n) => n.id === "UNK-1")?.status).toBe("WAIVED");
    expect(materialized.nodes.find((n) => n.id === "UNK-2")?.status).toBe("WAIVED");
  });

  it("rejects missing --by option or missing positional argument", async () => {
    const { cwd, graph } = await workspace();
    const beforeEvents = await graph.readEvents();

    const noArgs = await invoke(cwd, ["waive"]);
    expect(noArgs.code).toBe(2);
    expect(noArgs.stderr.text()).toMatch(/Usage: ariadne waive/i);

    const noBy = await invoke(cwd, ["waive", "UNK-1"]);
    expect(noBy.code).toBe(2);
    expect(noBy.stderr.text()).toMatch(/--by/i);

    const emptyBy = await invoke(cwd, ["waive", "UNK-1", "--by", ""]);
    expect(emptyBy.code).toBe(2);

    expect(await graph.readEvents()).toEqual(beforeEvents);
  });

  it("provides --help and -h usage documentation without modifying workspace", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "ariadne-cli-waive-help-"));

    const helpResult = await invoke(emptyDir, ["waive", "--help"]);
    expect(helpResult.code).toBe(0);
    expect(helpResult.stdout.text().trim()).toBe("Usage: ariadne waive <node-id> --by <decision-id>");
    expect(helpResult.stderr.text()).toBe("");
    expect(readdirSync(emptyDir)).toEqual([]);

    const shortHelpResult = await invoke(emptyDir, ["waive", "-h"]);
    expect(shortHelpResult.code).toBe(0);
    expect(shortHelpResult.stdout.text().trim()).toBe("Usage: ariadne waive <node-id> --by <decision-id>");
    expect(shortHelpResult.stderr.text()).toBe("");
    expect(readdirSync(emptyDir)).toEqual([]);
  });
});
