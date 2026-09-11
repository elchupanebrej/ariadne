import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
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
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-supersede-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  for (const item of [
    node("DEC-1", "DEC", "DECIDED"),
    node("DEC-2", "DEC", "DECIDED"),
    node("DEC-3", "DEC", "DECIDED"),
    node("DEC-SUPERSEDED", "DEC", "DECIDED", { status: "SUPERSEDED" }),
    node("DEC-REOPENED", "DEC", "DECIDED", { status: "RE-OPENED" }),
    node("DEC-SCOPE-A", "DEC", "DECIDED", { decision_scope: "auth-strategy" }),
    node("DEC-SCOPE-A2", "DEC", "DECIDED", { decision_scope: "auth-strategy" }),
    node("DEC-SCOPE-B", "DEC", "DECIDED", { decision_scope: "storage-engine" }),
    node("DEC-NO-SCOPE", "DEC", "DECIDED"),
    node("CLM-1", "CLM", "DERIVED", { dependencies: ["DEC-1"] }),
    node("CAN-1", "CAN", "PROPOSED"),
    node("ASM-TERM", "ASM", "ASSUMED", { status: "INVALIDATED", dependencies: ["DEC-1"] }),
    node("UNK-1", "UNK", "UNKNOWN"),
    node("EVD-1", "EVD", "FACT"),
  ]) {
    await storage.appendNode(item);
  }
  // Edge CAN-1 depends_on DEC-1
  await storage.appendEdge({
    source: "CAN-1",
    target: "DEC-1",
    type: "depends_on",
  });
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

describe("ariadne supersede", () => {
  it("supersedes a decision by another decision, updating graph, state, card, index, and reverse neighbors", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-2"]);

    expect(result.code).toBe(0);
    expect(result.stderr.text()).toBe("");
    const receipt = JSON.parse(result.stdout.text().trim()) as {
      node_id: string;
      superseded_by: string;
      status: string;
    };
    expect(receipt).toMatchObject({
      node_id: "DEC-1",
      superseded_by: "DEC-2",
      status: "SUPERSEDED",
    });

    const graph = await storage.materialize();
    const oldDec = graph.nodes.find((n) => n.id === "DEC-1");
    expect(oldDec).toBeDefined();
    expect(oldDec).toMatchObject({
      id: "DEC-1",
      status: "SUPERSEDED",
      superseded_by: "DEC-2",
    });

    // supersedes edge added in the same transaction
    const edge = graph.edges.find(
      (e) => e.source === "DEC-2" && e.target === "DEC-1" && e.type === "supersedes",
    );
    expect(edge).toBeDefined();

    // Reverse-topology neighbors: CLM-1 and CAN-1 dependent on DEC-1 marked NEEDS_REVIEW
    const clm = graph.nodes.find((n) => n.id === "CLM-1");
    expect(clm?.status).toBe("NEEDS_REVIEW");
    const can = graph.nodes.find((n) => n.id === "CAN-1");
    expect(can?.status).toBe("NEEDS_REVIEW");

    // Terminal neighbor ASM-TERM should remain INVALIDATED
    const asmTerm = graph.nodes.find((n) => n.id === "ASM-TERM");
    expect(asmTerm?.status).toBe("INVALIDATED");

    // Superseding decision DEC-2 must remain live (not marked NEEDS_REVIEW)
    const newDec = graph.nodes.find((n) => n.id === "DEC-2");
    expect(newDec?.status).not.toBe("NEEDS_REVIEW");

    // No Operational Notice generated
    expect(existsSync(join(cwd, ".planning", "ariadne", "NOTICES.jsonl"))).toBe(false);

    // Events recorded atomically: old decision update, edge, and reverse neighbors review
    const events = await storage.readEvents();
    expect(events.length).toBeGreaterThan(beforeEvents.length);
    const decEvent = events.find(
      (e) => e.kind === "node" && e.node.id === "DEC-1" && e.node.status === "SUPERSEDED",
    );
    expect(decEvent).toBeDefined();
    expect((decEvent as { node: { superseded_by?: string } }).node.superseded_by).toBe("DEC-2");
    const edgeEvent = events.find(
      (e) =>
        e.kind === "edge" &&
        e.edge.source === "DEC-2" &&
        e.edge.target === "DEC-1" &&
        e.edge.type === "supersedes",
    );
    expect(edgeEvent).toBeDefined();

    // State frontier checks: old decision is terminal, removed from active frontier
    const state = await storage.readState<Record<string, unknown>>();
    expect(state?.frontier).not.toContain("DEC-1");
    expect(state?.active_notices ?? []).toEqual([]);

    const statusResult = await invoke(cwd, ["status", "--format", "json"]);
    expect(statusResult.code).toBe(0);
    const statusJson = JSON.parse(statusResult.stdout.text()) as {
      frontier: string[];
    };
    expect(statusJson.frontier).not.toContain("DEC-1");

    // Card files updated
    const card = await readFile(join(cwd, ".ariadne", "cards", "DEC-1.md"), "utf8");
    expect(card).toContain("- Status: SUPERSEDED");
    expect(card).toContain("superseded_by");
    expect(card).toContain("DEC-2");

    const clmCard = await readFile(join(cwd, ".ariadne", "cards", "CLM-1.md"), "utf8");
    expect(clmCard).toContain("- Status: NEEDS_REVIEW");

    const canCard = await readFile(join(cwd, ".ariadne", "cards", "CAN-1.md"), "utf8");
    expect(canCard).toContain("- Status: NEEDS_REVIEW");

    // INDEX.md updated
    const index = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");
    expect(index).not.toMatch(/\|\s*DEC-1\s*\|/);
  });

  it("is idempotent when re-running the exact same supersede command", async () => {
    const { cwd, storage } = await workspace();

    const first = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-2"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await storage.readEvents();

    const second = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-2"]);
    expect(second.code).toBe(0);
    const eventsAfterSecond = await storage.readEvents();

    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
    expect(eventsAfterSecond).toEqual(eventsAfterFirst);
  });

  it("fails with a conflict error if a different closer is supplied for an already-superseded decision", async () => {
    const { cwd, storage } = await workspace();

    const first = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-2"]);
    expect(first.code).toBe(0);
    const eventsAfterFirst = await storage.readEvents();

    const second = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-3"]);
    expect(second.code).toBe(2);
    expect(second.stderr.text()).toMatch(/conflict/i);

    const eventsAfterSecond = await storage.readEvents();
    expect(eventsAfterSecond.length).toBe(eventsAfterFirst.length);
  });

  it("rejects superseding a non-DEC target with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "UNK-1", "--by", "DEC-2"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/DEC/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent target decision with a clear error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "DEC-NONEXISTENT", "--by", "DEC-2"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a non-DEC node for --by with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "DEC-1", "--by", "EVD-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/DEC/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a nonexistent node for --by with a clear validation error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-NONEXISTENT"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/not found/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects self-reference when a decision supersedes itself", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const result = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-1"]);
    expect(result.code).toBe(2);
    expect(result.stderr.text()).toMatch(/self-reference/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("rejects a SUPERSEDED or RE-OPENED decision for --by with a liveness guard error", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const superseded = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-SUPERSEDED"]);
    expect(superseded.code).toBe(2);
    expect(superseded.stderr.text()).toMatch(/live|SUPERSEDED/i);

    const reopened = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-REOPENED"]);
    expect(reopened.code).toBe(2);
    expect(reopened.stderr.text()).toMatch(/live|RE-OPENED/i);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  describe("decision scope matching", () => {
    it("rejects supersession when both decisions declare different decision_scopes", async () => {
      const { cwd, storage } = await workspace();
      const beforeEvents = await storage.readEvents();

      const result = await invoke(cwd, ["supersede", "DEC-SCOPE-A", "--by", "DEC-SCOPE-B"]);
      expect(result.code).toBe(2);
      expect(result.stderr.text()).toMatch(/scope|mismatch/i);

      expect(await storage.readEvents()).toEqual(beforeEvents);
    });

    it("allows supersession when both decisions declare matching decision_scopes", async () => {
      const { cwd, storage } = await workspace();

      const result = await invoke(cwd, ["supersede", "DEC-SCOPE-A", "--by", "DEC-SCOPE-A2"]);
      expect(result.code).toBe(0);

      const graph = await storage.materialize();
      expect(graph.nodes.find((n) => n.id === "DEC-SCOPE-A")?.status).toBe("SUPERSEDED");
    });

    it("allows supersession when target has decision_scope but --by omits it", async () => {
      const { cwd, storage } = await workspace();

      const result = await invoke(cwd, ["supersede", "DEC-SCOPE-A", "--by", "DEC-NO-SCOPE"]);
      expect(result.code).toBe(0);

      const graph = await storage.materialize();
      expect(graph.nodes.find((n) => n.id === "DEC-SCOPE-A")?.status).toBe("SUPERSEDED");
    });

    it("allows supersession when --by has decision_scope but target omits it", async () => {
      const { cwd, storage } = await workspace();

      const result = await invoke(cwd, ["supersede", "DEC-NO-SCOPE", "--by", "DEC-SCOPE-A"]);
      expect(result.code).toBe(0);

      const graph = await storage.materialize();
      expect(graph.nodes.find((n) => n.id === "DEC-NO-SCOPE")?.status).toBe("SUPERSEDED");
    });

    it("allows supersession when neither decision declares a decision_scope", async () => {
      const { cwd, storage } = await workspace();

      const result = await invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-2"]);
      expect(result.code).toBe(0);

      const graph = await storage.materialize();
      expect(graph.nodes.find((n) => n.id === "DEC-1")?.status).toBe("SUPERSEDED");
    });
  });

  it("serializes concurrent supersede operations under storage lock", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const [first, second] = await Promise.all([
      invoke(cwd, ["supersede", "DEC-1", "--by", "DEC-3"]),
      invoke(cwd, ["supersede", "DEC-2", "--by", "DEC-3"]),
    ]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);

    const events = await storage.readEvents();
    expect(events.length).toBeGreaterThan(beforeEvents.length + 1);

    const graph = await storage.materialize();
    expect(graph.nodes.find((n) => n.id === "DEC-1")?.status).toBe("SUPERSEDED");
    expect(graph.nodes.find((n) => n.id === "DEC-2")?.status).toBe("SUPERSEDED");
  });

  it("rejects missing --by option or missing positional argument", async () => {
    const { cwd, storage } = await workspace();
    const beforeEvents = await storage.readEvents();

    const noArgs = await invoke(cwd, ["supersede"]);
    expect(noArgs.code).toBe(2);
    expect(noArgs.stderr.text()).toMatch(/Usage: ariadne supersede/i);

    const noBy = await invoke(cwd, ["supersede", "DEC-1"]);
    expect(noBy.code).toBe(2);
    expect(noBy.stderr.text()).toMatch(/--by/i);

    const emptyBy = await invoke(cwd, ["supersede", "DEC-1", "--by", ""]);
    expect(emptyBy.code).toBe(2);

    expect(await storage.readEvents()).toEqual(beforeEvents);
  });

  it("provides --help and -h usage documentation without modifying workspace", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "ariadne-cli-supersede-help-"));

    const helpResult = await invoke(emptyDir, ["supersede", "--help"]);
    expect(helpResult.code).toBe(0);
    expect(helpResult.stdout.text().trim()).toBe("Usage: ariadne supersede <node-id> --by <decision-id>");
    expect(helpResult.stderr.text()).toBe("");
    expect(readdirSync(emptyDir)).toEqual([]);

    const shortHelpResult = await invoke(emptyDir, ["supersede", "-h"]);
    expect(shortHelpResult.code).toBe(0);
    expect(shortHelpResult.stdout.text().trim()).toBe("Usage: ariadne supersede <node-id> --by <decision-id>");
    expect(shortHelpResult.stderr.text()).toBe("");
    expect(readdirSync(emptyDir)).toEqual([]);
  });
});
