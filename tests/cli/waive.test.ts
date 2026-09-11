import { mkdtemp, readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
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
  ...extra,
});

const workspace = async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-waive-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  for (const item of [
    node("UNK-1", "UNK", "UNKNOWN"),
    node("UNK-2", "UNK", "UNKNOWN"),
    node("DEC-1", "DEC", "DECIDED"),
    node("DEC-2", "DEC", "DECIDED"),
    node("DEC-SUPERSEDED", "DEC", "DECIDED", { status: "SUPERSEDED" }),
    node("DEC-REOPENED", "DEC", "DECIDED", { status: "RE-OPENED" }),
    node("ASM-1", "ASM", "ASSUMED"),
    node("EVD-1", "EVD", "FACT"),
  ]) {
    await storage.appendNode(item);
  }
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

describe("ariadne waive", () => {
  it("waives an unknown by a decision, updating graph, state, card, and index", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

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

    const graph = await storage.materialize();
    const unk = graph.nodes.find((n) => n.id === "UNK-1");
    expect(unk).toBeDefined();
    expect(unk).toMatchObject({
      id: "UNK-1",
      status: "WAIVED",
      waived_by: "DEC-1",
    });

    const events = await storage.readEvents();
    expect(events.length).toBe(beforeEvents.length + 1);
    const waiveEvent = events.find(
      (e) => e.kind === "node" && e.node.id === "UNK-1" && e.node.status === "WAIVED",
    );
    expect(waiveEvent).toBeDefined();
    expect((waiveEvent as { node: { waived_by?: string } }).node.waived_by).toBe("DEC-1");

    const state = await storage.readState<Record<string, unknown>>();
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
    const { cwd, storage } = await workspace();

    const first = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await storage.readEvents();

    const second = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(second.code).toBe(0);
    const eventsAfterSecond = await storage.readEvents();

    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
    expect(eventsAfterSecond).toEqual(eventsAfterFirst);
  });

  it("fails with a conflict error if a different closer is supplied for an already-waived node", async () => {
    const { cwd, storage } = await workspace();

    const first = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await storage.readEvents();

    const second = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-2"]);
    expect(second.code).toBe(2);
    expect(second.stderr.text()).toMatch(/conflict/i);

    const eventsAfterSecond = await storage.readEvents();
    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
  });

  it("rejects waiving a non-UNK node with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["waive", "ASM-1", "--by", "DEC-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/UNK/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent target node with a clear error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-NONEXISTENT", "--by", "DEC-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a non-DEC node for --by with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "EVD-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/DEC/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent node for --by with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-NONEXISTENT"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a SUPERSEDED or RE-OPENED decision for --by with a liveness guard error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const superseded = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-SUPERSEDED"]);
    expect(superseded.code).toBe(2);
    expect(superseded.stderr.text()).toMatch(/live|SUPERSEDED/i);

    const reopened = await invoke(cwd, ["waive", "UNK-1", "--by", "DEC-REOPENED"]);
    expect(reopened.code).toBe(2);
    expect(reopened.stderr.text()).toMatch(/live|RE-OPENED/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects self-reference when the target unknown itself is supplied as --by", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["waive", "UNK-1", "--by", "UNK-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/self-reference/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("serializes concurrent waive operations under storage lock", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const [first, second] = await Promise.all([
      invoke(cwd, ["waive", "UNK-1", "--by", "DEC-1"]),
      invoke(cwd, ["waive", "UNK-2", "--by", "DEC-1"]),
    ]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);

    const events = await storage.readEvents();
    expect(events.length).toBe(beforeEvents.length + 2);

    const graph = await storage.materialize();
    expect(graph.nodes.find((n) => n.id === "UNK-1")?.status).toBe("WAIVED");
    expect(graph.nodes.find((n) => n.id === "UNK-2")?.status).toBe("WAIVED");
  });

  it("rejects missing --by option or missing positional argument", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const noArgs = await invoke(cwd, ["waive"]);
    expect(noArgs.code).toBe(2);
    expect(noArgs.stderr.text()).toMatch(/Usage: ariadne waive/i);

    const noBy = await invoke(cwd, ["waive", "UNK-1"]);
    expect(noBy.code).toBe(2);
    expect(noBy.stderr.text()).toMatch(/--by/i);

    const emptyBy = await invoke(cwd, ["waive", "UNK-1", "--by", ""]);
    expect(emptyBy.code).toBe(2);

    expect(await storage.readEvents()).toEqual(beforeEvents);
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
