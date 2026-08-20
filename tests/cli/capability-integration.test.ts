import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

const invoke = (cwd: string, args: string[]) => {
  const stdout = capture();
  const stderr = capture();
  return runCli(args, { cwd, stdout: stdout.stream, stderr: stderr.stream }).then((code) => ({
    code,
    stdout,
    stderr,
  }));
};

const workspace = () => mkdtemp(join(tmpdir(), "ariadne-cli-capability-"));

describe("CLI capability integrations", () => {
  it("uses the GSD overlay for graph commands without creating .ariadne", async () => {
    const cwd = await workspace();
    await mkdir(join(cwd, ".planning"));

    const result = await invoke(cwd, [
      "node",
      "add",
      "TASK",
      "TASK-1",
      "--title",
      "Task",
      "--payload",
      '{"provenance_type":"FACT"}',
    ]);

    expect(result.code).toBe(0);
    expect(existsSync(join(cwd, ".planning", "ariadne", "GRAPH.jsonl"))).toBe(true);
    expect(existsSync(join(cwd, ".ariadne"))).toBe(false);
  });

  it("persists invalidation notices in standalone mode and emits the banner", async () => {
    const cwd = await workspace();
    const storage = new GraphStorage(join(cwd, ".ariadne"));
    await storage.appendNode({
      id: "EVD-1",
      type: "EVD",
      provenance_type: "FACT",
      statement: "Measured falsification",
    });
    await storage.appendNode({
      id: "ASM-1",
      type: "ASM",
      provenance_type: "ASSUMED",
      statement: "Assumption",
    });
    await storage.appendEdge({ source: "EVD-1", type: "falsifies", target: "ASM-1" });

    const result = await invoke(cwd, ["invalidate", "ASM-1", "--by", "EVD-1"]);

    expect(result.code).toBe(0);
    expect(result.stdout.text()).toContain("ARIADNE OPERATIONAL NOTICE");
    expect(await readFile(join(cwd, ".ariadne", "NOTICES.jsonl"), "utf8")).toContain(
      '"falsified_id":"ASM-1"',
    );
    expect(JSON.parse(await readFile(join(cwd, ".ariadne", "STATE.yaml"), "utf8"))).toMatchObject({
      active_notices: ["NOT-001"],
    });
    expect(existsSync(join(cwd, ".planning"))).toBe(false);
  });

  it("persists GSD invalidation notices without changing SUMMARY.md or creating a shadow", async () => {
    const cwd = await workspace();
    const summary = join(cwd, ".planning", "phases", "01-foundation", "SUMMARY.md");
    await mkdir(join(cwd, ".planning", "phases", "01-foundation"), { recursive: true });
    await writeFile(summary, "# Completed\n");
    const before = await readFile(summary, "utf8");
    const storage = new GraphStorage(join(cwd, ".planning", "ariadne"));
    await storage.appendNode({ id: "EVD-1", type: "EVD", provenance_type: "FACT", statement: "Evidence" });
    await storage.appendNode({ id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Hypothesis" });
    await storage.appendEdge({ source: "EVD-1", type: "falsifies", target: "HYP-1" });

    const result = await invoke(cwd, ["invalidate", "HYP-1", "--by", "EVD-1"]);

    expect(result.code).toBe(0);
    expect(result.stdout.text()).toContain("ARIADNE OPERATIONAL NOTICE");
    expect(await readFile(summary, "utf8")).toBe(before);
    expect(await readFile(join(cwd, ".planning", "ariadne", "NOTICES.jsonl"), "utf8")).toContain(
      '"falsified_id":"HYP-1"',
    );
    expect(existsSync(join(cwd, ".ariadne"))).toBe(false);
  });

  it("persists Matt ingestion through the GSD overlay", async () => {
    const cwd = await workspace();
    await mkdir(join(cwd, ".planning"));
    await writeFile(
      join(cwd, "result.json"),
      JSON.stringify({
        id: "EVD-1",
        statement: "A measured result",
        red_capable: true,
        executed: true,
        verdict: "SUPPORTED",
        method: "focused test",
        rung: 4,
        test_command: "npm test",
        result: "passed",
        stdout_digest: "sha256:test",
        reproducible_environment: "node 20",
      }),
    );

    const result = await invoke(cwd, ["ingest", "matt", "diagnosing-bugs", "result.json"]);

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.text())).toMatchObject({ id: "EVD-1", type: "EVD" });
    expect(await new GraphStorage(join(cwd, ".planning", "ariadne")).materialize()).toMatchObject({
      nodes: [expect.objectContaining({ id: "EVD-1", type: "EVD" })],
    });
    expect(existsSync(join(cwd, ".ariadne"))).toBe(false);
  });

  it("validates envelope files and rejects malformed input", async () => {
    const cwd = await workspace();
    const file = join(cwd, "envelope.json");
    await writeFile(file, JSON.stringify({ envelope_id: "not-a-uuid" }));

    const result = await invoke(cwd, ["envelope", "verify", "envelope.json"]);

    expect(result.code).toBe(1);
    expect(result.stderr.text()).toMatch(/envelope|uuid/i);
  });

  it("returns local validation receipts for envelope send and receive", async () => {
    const cwd = await workspace();
    await writeFile(
      join(cwd, "envelope.json"),
      JSON.stringify({
        envelope_id: "00000000-0000-4000-8000-000000000001",
        correlation_id: "corr-1",
        timestamp: "2026-08-20T00:00:00.000Z",
        sender_role: "ImplementationAgent",
        target_role: "VerificationAgent",
        epistemic_mode: "Standard",
        provenance_payload: {
          node_id: "EVD-1",
          provenance_type: "FACT",
          statement: "A validated receipt",
          confidence_level: 1,
        },
      }),
    );

    for (const action of ["send", "receive"] as const) {
      const result = await invoke(cwd, ["envelope", action, "envelope.json"]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout.text())).toMatchObject({
        operation: action,
        valid: true,
        envelope_id: "00000000-0000-4000-8000-000000000001",
      });
    }
  });

  it("aliases verify to gate all and points op receipts at matching rules", async () => {
    const cwd = await workspace();
    const verified = await invoke(cwd, ["verify"]);
    expect(verified.code).toBe(0);
    expect(JSON.parse(verified.stdout.text())).toMatchObject({ gate: "all", passed: true });

    const operation = await invoke(cwd, ["op", "frame"]);
    expect(operation.code).toBe(0);
    expect(JSON.parse(operation.stdout.text())).toEqual({
      operation: "frame",
      rule: "rules/10-frame.md",
    });
  });
});
