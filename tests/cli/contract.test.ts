import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

const invoke = async (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  const code = await runCli(args, {
    cwd,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });
  return { code, stdout: stdout.text(), stderr: stderr.text() };
};

describe("canonical CLI contract", () => {
  it("publishes only the canonical command grammar and version surface", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-help-"));
    const help = await invoke(cwd, ["--help"]);

    expect(help.code).toBe(0);
    expect(help.stderr).toBe("");
    for (const usage of [
      "ariadne init [--root <path>]",
      "ariadne status [--format json]",
      "ariadne node (add|update|get|list|remove) [options]",
      "ariadne edge (add|remove|list) [options]",
      "ariadne waive <node-id> --by <decision-id>",
      "ariadne supersede <node-id> --by <decision-id>",
      "ariadne invalidate <node-id> --by <evidence-id>",
      "ariadne gate <name> [--format json]",
      "ariadne verify [--format json]",
      "ariadne ingest <file> [--type <type>]",
      "ariadne report [--format (json|markdown)] [--out <path>]",
      "ariadne viz [--format (dot|svg|mermaid)]",
      "ariadne template (init|apply|list) [options]",
      "ariadne migrate [--dry-run] [--rollback <id>]",
      "ariadne merge-driver <ancestor> <current> <other> <result>",
      "ariadne merge-resolve [--auto]",
      "ariadne merge-setup [--hooks]",
      "ariadne merge-doctor",
      "ariadne merge-check",
      "ariadne merge-sync",
    ]) {
      expect(help.stdout).toContain(usage);
    }
    for (const removed of [
      "ariadne-reasoning",
      "--json",
      "ingest matt",
      "ingest gsd",
      "[FRAME-id]",
      "--mode",
      "--force",
      "--protocol-version",
    ]) {
      expect(help.stdout).not.toContain(removed);
    }

    const version = await invoke(cwd, ["--version"]);
    expect(version).toMatchObject({ code: 0, stdout: "0.2.0\n", stderr: "" });
  });

  it("accepts the canonical root and format options", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-root-"));
    const root = join(cwd, "project");
    const initialized = await invoke(cwd, ["init", "--root", root]);

    expect(initialized.code).toBe(0);
    expect(await readFile(join(root, ".ariadne", "GRAPH.jsonl"), "utf8")).toBe("");

    const status = await invoke(root, ["status", "--format", "json"]);
    expect(status.code).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      graph_health: { healthy: true, nodes: 0, edges: 0 },
    });
    expect(status.stderr).toBe("");
  });

  it("parses migration and merge options as fatal input errors", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-parser-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);

    const duplicateMigrationOption = await invoke(cwd, ["migrate", "--dry-run", "--dry-run"]);
    expect(duplicateMigrationOption.code).toBe(2);
    expect(duplicateMigrationOption.stderr).toContain("INVALID_INPUT");

    const conflictingMigrationOptions = await invoke(cwd, [
      "migrate",
      "--dry-run",
      "--rollback",
      "MIG-example",
    ]);
    expect(conflictingMigrationOptions.code).toBe(2);
    expect(conflictingMigrationOptions.stderr).toContain("INVALID_INPUT");

    const invalidMergeFormat = await invoke(cwd, [
      "merge-driver",
      "ancestor",
      "current",
      "other",
      "result",
      "--format",
      "yaml",
    ]);
    expect(invalidMergeFormat.code).toBe(2);
    expect(invalidMergeFormat.stderr).toContain("INVALID_INPUT");
  });

  it("ingests a typed file and renders report and visualization formats", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-formats-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);
    const input = join(cwd, "artifact.json");
    await writeFile(input, JSON.stringify({ statement: "A typed observation" }));

    const ingested = await invoke(cwd, ["ingest", input, "--type", "OBS"]);
    expect(ingested.code).toBe(0);
    expect(JSON.parse(ingested.stdout)).toMatchObject({
      type: "OBS",
      statement: "A typed observation",
    });

    const report = await invoke(cwd, ["report", "--format", "markdown"]);
    expect(report.code).toBe(0);
    expect(report.stdout).toContain("ARIADNE DECISION-TREE REPORT");

    for (const format of ["dot", "svg", "mermaid"]) {
      const viz = await invoke(cwd, ["viz", "--format", format]);
      expect(viz.code).toBe(0);
      expect(viz.stdout).toContain(format === "dot" ? "digraph" : format === "svg" ? "<svg" : "flowchart");
    }
  });

  it("uses four merge-driver paths and preserves the result path", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-merge-"));
    const ancestor = join(cwd, "ancestor.jsonl");
    const current = join(cwd, "current.jsonl");
    const other = join(cwd, "other.jsonl");
    const result = join(cwd, "result.jsonl");
    const base = JSON.stringify({
      kind: "node",
      node: { id: "TASK-BASE", type: "TASK", provenance_type: "FACT", statement: "base" },
    }) + "\n";
    const currentContent = base + JSON.stringify({
      kind: "node",
      node: { id: "TASK-CURRENT", type: "TASK", provenance_type: "FACT", statement: "current" },
    }) + "\n";
    await Promise.all([
      writeFile(ancestor, base),
      writeFile(current, currentContent),
      writeFile(other, base),
      writeFile(result, "sentinel\n"),
    ]);

    const merged = await invoke(cwd, ["merge-driver", ancestor, current, other, result]);
    expect(merged.code).toBe(0);
    expect(await readFile(result, "utf8")).toContain("TASK-CURRENT");
    expect(await readFile(current, "utf8")).toBe(currentContent);
  });

  it("returns exit 1 and a canonical diagnostic for a four-path merge divergence", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-merge-diverged-"));
    const ancestor = join(cwd, "ancestor.jsonl");
    const current = join(cwd, "current.jsonl");
    const other = join(cwd, "other.jsonl");
    const result = join(cwd, "result.jsonl");
    const event = (statement: string) => JSON.stringify({
      kind: "node",
      node: { id: "TASK-SHARED", type: "TASK", provenance_type: "PROPOSED", statement },
    });
    await Promise.all([
      writeFile(ancestor, `${event("ancestor")}\n`),
      writeFile(current, `${event("current")}\n`),
      writeFile(other, `${event("other")}\n`),
      writeFile(result, "sentinel\n"),
    ]);

    const merged = await invoke(cwd, [
      "merge-driver",
      ancestor,
      current,
      other,
      result,
      "--json",
    ]);

    expect(merged.code).toBe(1);
    expect(JSON.parse(merged.stdout)).toMatchObject({ outcome: "DIVERGED" });
    expect(JSON.parse(merged.stderr)).toEqual([
      expect.objectContaining({ code: "MERGE_DIVERGED" }),
    ]);
    expect(await readFile(result, "utf8")).toContain("CTR-merge-");
  });

  it("returns exit 1 with a canonical domain diagnostic and exit 2 for fatal JSON syntax", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-exits-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);
    await new GraphStorage(join(cwd, ".ariadne")).appendNode({
      id: "CTR-contract",
      type: "CTR",
      provenance_type: "PROPOSED",
      statement: "The contract fixture is intentionally unresolved.",
      status: "ACTIVE",
    });

    const negative = await invoke(cwd, ["gate", "semantic", "--format", "json"]);
    expect(negative.code).toBe(1);
    expect(JSON.parse(negative.stderr)).toEqual([
      expect.objectContaining({ code: "GATE_FAILED" }),
    ]);

    const fatal = await invoke(cwd, ["status", "--format", "json", "--unknown"]);
    expect(fatal.code).toBe(2);
    expect(JSON.parse(fatal.stderr)).toEqual(
      expect.objectContaining({ code: "INVALID_INPUT" }),
    );
  });

  it("normalizes malformed command syntax to INVALID_INPUT across command families", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-errors-"));
    const cases = [
      ["node", "unknown-subcommand"],
      ["edge", "list", "--unknown"],
      ["merge-check", "--unknown"],
      ["merge-sync", "--unknown"],
      ["merge-doctor", "--format", "yaml"],
      ["merge-resolve", "--auto", "--expected-digest", "digest"],
    ];

    for (const args of cases) {
      const result = await invoke(cwd, args);
      expect(result.code, args.join(" ")).toBe(2);
      expect(result.stderr, args.join(" ")).toContain("INVALID_INPUT");
    }
  });

  it("accepts the canonical format spelling for merge diagnostics", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-merge-format-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);

    for (const command of ["merge-check", "merge-sync"]) {
      const result = await invoke(cwd, [command, "--format", "json"]);
      expect(result.code, command).toBe(0);
      expect(() => JSON.parse(result.stdout), command).not.toThrow();
    }
  });

  it("accepts safe automatic-resolution discovery without mutating a clean workspace", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-auto-resolve-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);
    const result = await invoke(cwd, ["merge-resolve", "--auto"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("No unresolved merge contradictions");
    expect(result.stderr).toBe("");
  });

  it("redacts external paths from malformed-ingest diagnostics", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-contract-redaction-"));
    expect((await invoke(cwd, ["init"])).code).toBe(0);
    const secret = "super-secret-value";
    const input = join(cwd, `artifact-token=${secret}.json`);
    await writeFile(input, "{ malformed");

    const result = await invoke(cwd, ["ingest", input, "--type", "OBS"]);

    expect(result.code).toBe(2);
    expect(result.stderr).not.toContain(secret);
    expect(result.stderr).toContain("INVALID_INPUT");
  });
});
