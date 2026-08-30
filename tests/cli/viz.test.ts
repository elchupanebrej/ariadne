import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage, type GraphEvent } from "../../src/graph/storage.js";
import { buildViz } from "../../src/cli/commands/viz.js";

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

describe("buildViz (pure HTML renderer)", () => {
  const events = [
    node("FRAME-viz-001", { title: "HTML decision tree", status: "ACTIVE" }),
    node("DEC-viz-01", {
      title: "Separate viz command",
      status: "DECIDED",
      provenance_type: "DECIDED",
      adversarial_critique: "Risk: HTML escapes must be tested.",
    }),
    node("UNK-viz-1", { status: "OPEN", statement: "Which layout? <script>alert(1)</script>" }),
    node("UNK-viz-2", { status: "RESOLVED", resolved_by: "DEC-viz-01" }),
    node("CAN-viz-1", { title: "Zero-JS static page" }),
    node("EVD-viz-1", { status: "OBSERVED", verdict: "SUPPORTED" }),
    node("OBS-viz-tomb", { status: "REMOVED" }),
    edge("DEC-viz-01", "derived_from", "FRAME-viz-001"),
    edge("CAN-viz-1", "depends_on", "FRAME-viz-001"),
    edge("EVD-viz-1", "supports", "CAN-viz-1"),
    edge("UNK-viz-1", "references", "FRAME-viz-001"),
    edge("UNK-viz-1", "references", "CAN-viz-1"),
  ];

  const html = buildViz(events, {
    cardsPrefix: "../cards",
    bookHref: "../../docs/nine_operations_software_en.html",
    graphPath: ".ariadne/GRAPH.jsonl",
  });

  it("renders a self-contained HTML document with tree, colors, and edge labels", () => {
    expect(html.html).toContain("<!DOCTYPE html>");
    expect(html.html).toContain("FRAME-viz-001");
    expect(html.html).toContain('class="edge-label">derived_from');
    expect(html.html).toContain('class="edge-label">depends_on');
    expect(html.html).toContain('class="prov-chip prov-DECIDED"');
    expect(html.html).toContain('class="type-badge">DEC');
    expect(html.html).toContain('tg-decision');
    expect(html.html).toContain('href="../cards/DEC-viz-01.md"');
    expect(html.html).toContain('<style>');
  });

  it("links every rendered node to its relevant diagram in the book", () => {
    expect(html.html.match(/class="help-link"/g)).toHaveLength(7);
    expect(html.html).toContain('href="../../docs/nine_operations_software_en.html#diagram-22"');
    expect(html.html).toContain('href="../../docs/nine_operations_software_en.html#diagram-60"');
    expect(html.html).toContain('href="../../docs/nine_operations_software_en.html#diagram-80"');
    expect(html.html).toContain('href="../../docs/nine_operations_software_en.html#diagram-136"');
    expect(html.html).toContain('aria-label="Open methodology help for DEC"');
  });

  it("strikes through tombstones and logs them as TOMBSTONE rows", () => {
    expect(html.html).toContain('stale');
    expect(html.html).toContain("OBS-viz-tomb");
    expect(html.html).toContain("TOMBSTONE</td><td class=\"mono\">OBS-viz-tomb");
    expect(html.html).not.toContain("append</td><td class=\"mono\">OBS-viz-tomb");
  });

  it("escapes HTML in statements", () => {
    expect(html.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html.html).not.toContain("<script>alert(1)</script>");
  });

  it("serializes object payloads as JSON instead of [object Object]", () => {
    const withObject = [
      ...events,
      node("OBS-viz-obj", { status: "ACTIVE", tooling_failure: { command: "viz", error: "boom" } }),
    ];
    const out = buildViz(withObject, { cardsPrefix: "../cards" });
    expect(out.html).not.toContain("[object Object]");
    expect(out.html).toContain("&quot;command&quot;:&quot;viz&quot;");
    expect(out.html).toContain("&quot;error&quot;:&quot;boom&quot;");
  });

  it("renders a repeated node once and stubs later occurrences", () => {
    const full = html.html.match(/id="node-0-UNK-viz-1"/g) ?? [];
    expect(full).toHaveLength(1);
    expect(html.html).toContain("UNK-viz-1 (rendered above)");
    expect(html.html).toContain('href="#node-0-UNK-viz-1"');
  });

  it("shows only open unknowns in the frontier header", () => {
    expect(html.html).toContain("UNK-viz-1");
    expect(html.html).toContain("Open unknowns: 1");
    expect(html.html).not.toContain("UNK-viz-2.md</a> —");
  });

  it("summarizes the change log like the text report", () => {
    expect(html.html).toContain("Change Log");
    expect(html.html).toContain("append</td><td class=\"mono\">DEC-viz-01");
    expect(html.html).toContain("append</td><td class=\"mono\">CAN-viz-1");
    expect(html.html).not.toContain("append</td><td class=\"mono\">OBS-viz-tomb");
    expect(html.summary.change_log).toEqual({ shown: 6, appends: 7 });
  });

  it("throws on a missing or non-FRAME root id", () => {
    expect(() => buildViz(events, { cardsPrefix: "../cards", rootId: "DEC-viz-01" })).toThrow(
      "Unknown FRAME",
    );
    expect(() => buildViz(events, { cardsPrefix: "../cards", rootId: "FRAME-missing" })).toThrow(
      "Unknown FRAME",
    );
  });
});

describe("ariadne viz command", () => {
  const seed = async (cwd: string) => {
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      type: "FRAME",
      id: "FRAME-viz-work",
      provenance_type: "FACT",
      title: "Viz effort",
      statement: "Visualization framed.",
    });
    await storage.appendNode({
      type: "DEC",
      id: "DEC-viz-choice",
      provenance_type: "DECIDED",
      title: "Viz choice",
      statement: "Decided on static HTML.",
    });
    await storage.appendEdge({
      source: "DEC-viz-choice",
      type: "derived_from",
      target: "FRAME-viz-work",
    });
  };

  it("persists a numbered HTML file and prints its path", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-viz-"));
    await seed(cwd);
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["viz"], { cwd, stdout: stdout.stream, stderr: stderr.stream });

    expect(code).toBe(0);
    expect(stderr.text()).toBe("");
    expect(stdout.text()).toContain("wrote .ariadne/reports/001-frame-viz-work.html");
    const files = readdirSync(join(cwd, ".ariadne", "reports"));
    expect(files).toEqual(["001-frame-viz-work.html"]);
    const persisted = readFileSync(join(cwd, ".ariadne", "reports", files[0]!), "utf8");
    expect(persisted).toContain("<!DOCTYPE html>");
    expect(persisted).toContain("FRAME-viz-work");
    expect(persisted).toContain(
      'href="../../docs/nine_operations_software_en.html#diagram-22"',
    );
  });

  it("shares the ordinal sequence with the text report", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-viz-ordinal-"));
    await seed(cwd);
    await runCli(["viz"], { cwd, stdout: capture().stream, stderr: capture().stream });
    await runCli(["report"], { cwd, stdout: capture().stream, stderr: capture().stream });

    const files = readdirSync(join(cwd, ".ariadne", "reports")).sort();
    expect(files).toEqual(["001-frame-viz-work.html", "002-frame-viz-work.md"]);
  });

  it("supports --json output and a single FRAME-id", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-viz-json-"));
    await seed(cwd);
    const jsonOut = capture();
    const code = await runCli(["viz", "FRAME-viz-work", "--json"], {
      cwd,
      stdout: jsonOut.stream,
      stderr: capture().stream,
    });

    expect(code).toBe(0);
    const parsed = JSON.parse(jsonOut.text()) as { file: string; mode: string; sections: unknown[] };
    expect(parsed.file).toBe(".ariadne/reports/001-frame-viz-work.html");
    expect(parsed.mode).toBe("tree");
    expect(parsed.sections).toHaveLength(1);
  });

  it("prints usage on --help without creating files", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-viz-help-"));
    const stdout = capture();
    const code = await runCli(["viz", "--help"], { cwd, stdout: stdout.stream, stderr: capture().stream });

    expect(code).toBe(0);
    expect(stdout.text().trim()).toBe("Usage: ariadne viz [FRAME-id] [--json]");
    expect(readdirSync(cwd)).toEqual([]);
  });

  it("mirrors viz output under .planning/ariadne in gsd mode", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-viz-gsd-"));
    const storage = new GraphStorage(join(cwd, ".planning", "ariadne"));
    await storage.writeState({ mode: "gsd" });
    await storage.appendNode({
      type: "FRAME",
      id: "FRAME-gsd-viz",
      provenance_type: "FACT",
      title: "Gsd viz",
      statement: "Visualization in gsd overlay.",
    });
    await storage.appendNode({
      type: "DEC",
      id: "DEC-gsd-viz",
      provenance_type: "DECIDED",
      title: "Gsd viz choice",
      statement: "Decided in gsd overlay.",
    });
    await storage.appendEdge({
      source: "DEC-gsd-viz",
      type: "derived_from",
      target: "FRAME-gsd-viz",
    });
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["viz"], { cwd, stdout: stdout.stream, stderr: stderr.stream });

    expect(code).toBe(0);
    expect(stderr.text()).toBe("");
    expect(existsSync(join(cwd, ".planning", "ariadne", "reports", "001-frame-gsd-viz.html"))).toBe(
      true,
    );
  });
});
