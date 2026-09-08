import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage, type GraphEvent } from "../../src/graph/storage.js";
import { buildReport } from "../../src/cli/commands/report.js";

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

// Edge orientation follows the live graph: source depends on / derives from
// target, so the root FRAME never appears as a source.
const node = (id: string, fields: Record<string, unknown>): GraphEvent => ({
  kind: "node",
  node: {
    provenance_type: "PROPOSED",
    statement: `Statement of ${id}. Second sentence.`,
    ...fields,
    id,
    type: id.split("-")[0],
  } as never,
});

const edge = (source: string, type: string, target: string): GraphEvent => ({
  kind: "edge",
  edge: { source, target, type } as never,
});

describe("buildReport (pure renderer)", () => {
  const events = [
    node("FRAME-rpt-001", {
      title: "Research decision-tree report",
      status: "ACTIVE",
    }),
    node("DEC-rpt-01", {
      title: "CLI renders the report",
      status: "DECIDED",
      adversarial_critique: "Risk: no CLI in host mode.",
      provenance_type: "DECIDED",
    }),
    node("OBS-tomb-1", {
      status: "REMOVED",
      adversarial_critique: "Why this observation was removed.",
    }),
    node("UNK-rpt-1", {
      status: "RESOLVED",
      resolved_by: "DEC-rpt-01",
    }),
    node("UNK-rpt-2", { status: "OPEN" }),
    node("EVD-rpt-1", { status: "OBSERVED", verdict: "SUPPORTED" }),
    // Children of the FRAME root, sorted by source id.
    edge("DEC-rpt-01", "derived_from", "FRAME-rpt-001"),
    edge("UNK-rpt-2", "references", "FRAME-rpt-001"),
    edge("EVD-rpt-1", "supports", "DEC-rpt-01"),
    edge("UNK-rpt-1", "references", "DEC-rpt-01"),
  ];

  it("renders a forest section per FRAME root with typed edges and statuses", () => {
    const { text, summary } = buildReport(events, { cardsPrefix: ".ariadne/cards" });

    expect(text).toContain("== TREE 1: FRAME-rpt-001 (5 nodes reachable) ==");
    expect(text).toContain("|-- derived_from --> DEC-rpt-01 [DECIDED] CLI renders the report");
    expect(summary.mode).toBe("forest");
    expect(summary.sections).toEqual([{ root: "FRAME-rpt-001", reachable: 5 }]);
  });

  it("derives intermediate answers per DEC-RPT-07 and marks unresolved UNKs honestly", () => {
    const { text } = buildReport(events, { cardsPrefix: ".ariadne/cards" });

    expect(text).toMatch(/UNK-rpt-1 \[RESOLVED\][^\n]*\n[^\n]*~ resolved by DEC-rpt-01/);
    expect(text).toMatch(/UNK-rpt-2 \[OPEN\][^\n]*\n[^\n]*~ UNRESOLVED/);
    expect(text).toMatch(/EVD-rpt-1 \[OBSERVED\][^\n]*\n[^\n]*~ verdict: SUPPORTED/);
    // DEC answers quote the first sentence of the statement (DEC-RPT-07);
    // adversarial critique surfaces as the change-log reason instead.
    expect(text).toMatch(
      /DEC-rpt-01 \[DECIDED\] CLI renders the report\n *\| *~ Statement of DEC-rpt-01\./,
    );
  });

  it("explains edge orientation once in the header of every mode", () => {
    const forest = buildReport(events, { cardsPrefix: ".ariadne/cards" });
    expect(forest.text.match(/edges read X --> Y: X depends on \/ derives from Y/g)?.length).toBe(1);

    const tree = buildReport(events, {
      cardsPrefix: ".ariadne/cards",
      rootId: "FRAME-rpt-001",
    });
    expect(tree.text.match(/edges read X --> Y: X depends on \/ derives from Y/g)?.length).toBe(1);
  });

  it("renders single-tree mode when a root frame is given", () => {
    const other = [
      ...events,
      node("FRAME-rpt-002", { status: "ACTIVE" }),
      edge("UNK-rpt-2", "references", "FRAME-rpt-002"),
    ];
    const { text, summary } = buildReport(other, {
      cardsPrefix: ".ariadne/cards",
      rootId: "FRAME-rpt-001",
    });

    expect(summary.mode).toBe("tree");
    expect(summary.sections).toEqual([{ root: "FRAME-rpt-001", reachable: 5 }]);
    expect(text).not.toContain("FRAME-rpt-002");
  });

  it("deduplicates repeated nodes as one-line stubs within a section", () => {
    const diamond = [
      node("FRAME-dia-1", { status: "ACTIVE" }),
      node("CAN-dia-a", { status: "PROPOSED" }),
      node("DEP-dia-b", { status: "ASSUMED" }),
      edge("CAN-dia-a", "derived_from", "FRAME-dia-1"),
      edge("DEP-dia-b", "depends_on", "FRAME-dia-1"),
      edge("CAN-dia-a", "depends_on", "DEP-dia-b"),
    ];
    const { text } = buildReport(diamond, { cardsPrefix: ".ariadne/cards" });

    // First reference renders fully; the later sibling repeats as a stub.
    expect(text.match(/DEP-dia-b/g)?.length).toBe(2);
    expect(text.match(/\(rendered above\)/g)?.length).toBe(1);
  });

  it("filters the change log to decisive appends plus tombstones with action/card/reason steps", () => {
    const { text, summary } = buildReport(events, { cardsPrefix: ".ariadne/cards" });

    expect(text).toContain(
      "== CHANGE LOG (filter: appends of CAN/DEC/EVD/UNK + tombstones; 5 of 6 appends shown) ==",
    );
    expect(text).toContain("[  1] append DEC-rpt-01 -> DECIDED");
    expect(text).toContain("[  2] TOMBSTONE OBS-tomb-1 -> REMOVED");
    expect(text).toContain(".ariadne/cards/OBS-tomb-1.md");
    expect(text).toContain("Why this observation was removed.");
    expect(summary.change_log).toEqual({ shown: 5, appends: 6 });
  });

  it("keeps every printed line inside the 100-column budget on shallow trees", () => {
    const long = [
      node("FRAME-wide-000001", {
        status: "ACTIVE",
        statement:
          "A very long statement that also keeps going well beyond one hundred columns of output here.",
      }),
    ];
    const { text } = buildReport(long, { cardsPrefix: ".ariadne/cards" });
    for (const line of text.split("\n")) {
      if (line.includes("-- subtree continued")) continue;
      expect(line.length).toBeLessThanOrEqual(100);
    }
  });

  it("continues outgrown subtrees as fresh column-0 blocks", () => {
    const chain = [node("FRAME-deep-1", { status: "ACTIVE" })];
    let previous = "FRAME-deep-1";
    for (let i = 1; i <= 12; i += 1) {
      const id = `DEC-deep-x${String(i).padStart(2, "0")}`;
      chain.push(
        node(id, { status: "DECIDED", provenance_type: "DECIDED" }),
        edge(id, "derived_from", previous),
      );
      previous = id;
    }
    const { text } = buildReport(chain, { cardsPrefix: ".ariadne/cards" });

    expect(text).toContain("-- subtree continued:");
    expect(text).toContain("-- subtree continued: derived_from --> DEC-deep-x12 --");
  });
});

const createWorkspace = async () => {
  const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-report-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  await storage.appendNode({
    type: "FRAME",
    id: "FRAME-login-retry",
    provenance_type: "FACT",
    title: "Login retry research",
    statement: "How should login retry behave.",
  });
  await storage.appendNode({
    type: "DEC",
    id: "DEC-login-backoff",
    provenance_type: "DECIDED",
    title: "Exponential backoff",
    statement: "Use exponential backoff. Jitter added later.",
  });
  await storage.appendEdge({
    source: "DEC-login-backoff",
    type: "derived_from",
    target: "FRAME-login-retry",
  });
  return cwd;
};

describe("ariadne report command", () => {
  it("persists a numbered report file named after the root frame", async () => {
    const cwd = await createWorkspace();
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["report"], { cwd, stdout: stdout.stream, stderr: stderr.stream });

    expect(code).toBe(0);
    expect(stderr.text()).toBe("");
    const files = readdirSync(join(cwd, ".ariadne", "reports"));
    expect(files).toEqual(["001-frame-login-retry.md"]);
    const persisted = readFileSync(join(cwd, ".ariadne", "reports", files[0]!), "utf8");
    expect(persisted).toContain("== TREE 1: FRAME-login-retry");
    expect(stdout.text()).toBe(persisted);
  });

  it("increments the report counter across runs", async () => {
    const cwd = await createWorkspace();
    await runCli(["report"], { cwd, stdout: capture().stream, stderr: capture().stream });

    const second = capture();
    await runCli(["report"], { cwd, stdout: second.stream, stderr: capture().stream });

    expect(readdirSync(join(cwd, ".ariadne", "reports"))).toContain("002-frame-login-retry.md");
  });

  it("emits minimal JSON following the text form", async () => {
    const cwd = await createWorkspace();
    const stdout = capture();

    const code = await runCli(["report", "--json"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });
    const parsed = JSON.parse(stdout.text()) as {
      file: string;
      mode: string;
      sections: { root: string; reachable: number }[];
      change_log: { shown: number };
    };

    expect(code).toBe(0);
    expect(parsed.file).toBe(".ariadne/reports/001-frame-login-retry.md");
    expect(parsed.mode).toBe("forest");
    expect(parsed.sections).toEqual([{ root: "FRAME-login-retry", reachable: 2 }]);
    expect(parsed.change_log).toEqual({ shown: 1, appends: 2 });
  });

  it("renders a single tree for an explicit frame argument", async () => {
    const cwd = await createWorkspace();
    await new GraphStorage(join(cwd, ".ariadne")).appendNode({
      type: "FRAME",
      id: "FRAME-other-effort",
      provenance_type: "FACT",
      title: "Other effort",
      statement: "Unrelated effort.",
    });
    const stdout = capture();

    const code = await runCli(["report", "FRAME-other-effort"], {
      cwd,
      stdout: stdout.stream,
      stderr: capture().stream,
    });

    expect(code).toBe(0);
    expect(stdout.text()).toContain("== TREE 1: FRAME-other-effort");
    expect(stdout.text()).not.toContain("FRAME-login-retry ");
  });

  it("fails with exit 1 for an unknown frame id", async () => {
    const cwd = await createWorkspace();
    const stderr = capture();

    const code = await runCli(["report", "FRAME-missing-1"], {
      cwd,
      stdout: capture().stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(2);
    expect(stderr.text()).toContain("Unknown FRAME");
  });

  it("mirrors reports under .planning/ariadne in gsd mode", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-report-gsd-"));
    const storage = new GraphStorage(join(cwd, ".planning", "ariadne"));
    await storage.writeState({ mode: "gsd" });
    await storage.appendNode({
      type: "FRAME",
      id: "FRAME-gsd-work",
      provenance_type: "FACT",
      title: "Gsd effort",
      statement: "Work framed in gsd mode.",
    });
    await storage.appendNode({
      type: "DEC",
      id: "DEC-gsd-choice",
      provenance_type: "DECIDED",
      title: "Gsd choice",
      statement: "Decided in gsd overlay.",
    });
    await storage.appendEdge({
      source: "DEC-gsd-choice",
      type: "derived_from",
      target: "FRAME-gsd-work",
    });
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["report"], { cwd, stdout: stdout.stream, stderr: stderr.stream });

    expect(code).toBe(0);
    expect(stderr.text()).toBe("");
    expect(existsSync(join(cwd, ".planning", "ariadne", "reports", "001-frame-gsd-work.md"))).toBe(
      true,
    );
    expect(stdout.text()).toContain(".planning/ariadne/cards/DEC-gsd-choice.md");
  });
});
