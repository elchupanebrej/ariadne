import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { EDGE_TYPES } from "../../src/core/schemas/edges.js";
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

const node = (id: string) => ({
  id,
  type: "TASK" as const,
  provenance_type: "FACT" as const,
  statement: id,
});

const workspace = async () => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-edge-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  await storage.appendNode(node("TASK-1"));
  await storage.appendNode(node("TASK-2"));
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

describe("ariadne edge", () => {
  it("adds and filters directed edges after endpoint validation", async () => {
    const { cwd, storage } = await workspace();
    const added = await invoke(cwd, ["edge", "add", "TASK-2", "depends_on", "TASK-1"]);

    expect(added.code).toBe(0);
    expect(JSON.parse(added.stdout.text())).toEqual({
      source: "TASK-2",
      type: "depends_on",
      target: "TASK-1",
    });
    expect((await storage.materialize()).edges).toHaveLength(1);

    const listed = await invoke(cwd, ["edge", "list", "--from", "TASK-2", "--relation", "depends_on"]);
    expect(listed.code).toBe(0);
    expect(JSON.parse(listed.stdout.text())).toEqual([
      { source: "TASK-2", type: "depends_on", target: "TASK-1" },
    ]);
  });

  it("rejects missing endpoints and invalid relations before persistence", async () => {
    const { cwd, storage } = await workspace();
    const missing = await invoke(cwd, ["edge", "add", "TASK-2", "supports", "TASK-404"]);
    expect(missing.code).toBe(2);
    expect(missing.stderr.text()).toContain("does not exist");

    const invalid = await invoke(cwd, ["edge", "add", "TASK-2", "not_a_relation", "TASK-1"]);
    expect(invalid.code).toBe(2);
    expect(invalid.stderr.text()).toContain("edge");
    expect((await storage.materialize()).edges).toEqual([]);
  });

  it("enumerates valid edge relations in errors and add help", async () => {
    const { cwd, storage } = await workspace();
    const relationList = EDGE_TYPES.join(", ");

    const addErr = await invoke(cwd, ["edge", "add", "TASK-1", "raises", "TASK-2"]);
    expect(addErr.code).toBe(2);
    expect(addErr.stderr.text()).toContain("Invalid edge relation: raises");
    expect(addErr.stderr.text()).toContain(relationList);

    const removeErr = await invoke(cwd, ["edge", "remove", "TASK-1", "raises", "TASK-2"]);
    expect(removeErr.code).toBe(2);
    expect(removeErr.stderr.text()).toContain("Invalid edge relation: raises");
    expect(removeErr.stderr.text()).toContain(relationList);

    const listErr = await invoke(cwd, ["edge", "list", "--relation", "raises"]);
    expect(listErr.code).toBe(2);
    expect(listErr.stderr.text()).toContain("Invalid edge relation: raises");
    expect(listErr.stderr.text()).toContain(relationList);

    const help = await invoke(cwd, ["edge", "add", "--help"]);
    expect(help.code).toBe(0);
    expect(help.stdout.text()).toContain("Usage: ariadne edge add <from_id> <relation> <to_id>");
    expect(help.stdout.text()).toContain(relationList);

    expect((await storage.materialize()).edges).toEqual([]);
  });

  it("rejects deductive cycles using graph validation before append", async () => {
    const { cwd, storage } = await workspace();
    expect((await invoke(cwd, ["edge", "add", "TASK-2", "depends_on", "TASK-1"])).code).toBe(0);
    const cycle = await invoke(cwd, ["edge", "add", "TASK-1", "depends_on", "TASK-2"]);

    expect(cycle.code).toBe(2);
    expect(cycle.stderr.text()).toContain("CYCLE");
    expect((await storage.materialize()).edges).toHaveLength(1);
  });

  it("reports actual vs expected argument count on arity errors", async () => {
    const { cwd } = await workspace();
    const twoArgs = await invoke(cwd, ["edge", "add", "TASK-2", "TASK-1"]);
    expect(twoArgs.code).toBe(2);
    expect(twoArgs.stderr.text()).toContain(
      "Usage: ariadne edge add <from_id> <relation> <to_id> (got 2, expected 3)",
    );

    const noArgs = await invoke(cwd, ["edge", "remove"]);
    expect(noArgs.code).toBe(2);
    expect(noArgs.stderr.text()).toContain(
      "Usage: ariadne edge remove <from_id> <relation> <to_id> (got 0, expected 3)",
    );

    const oneArg = await invoke(cwd, ["edge", "add", "TASK-2"]);
    expect(oneArg.stderr.text()).toContain(
      "Usage: ariadne edge add <from_id> <relation> <to_id> (got 1, expected 3)",
    );
  });

  it("removes an edge with an append-only tombstone", async () => {
    const { cwd, storage } = await workspace();
    expect((await invoke(cwd, ["edge", "add", "TASK-2", "supports", "TASK-1"])).code).toBe(0);
    const removed = await invoke(cwd, ["edge", "remove", "TASK-2", "supports", "TASK-1"]);

    expect(removed.code).toBe(0);
    expect(JSON.parse(removed.stdout.text())).toEqual({
      source: "TASK-2",
      type: "supports",
      target: "TASK-1",
    });
    expect((await storage.materialize()).edges).toEqual([]);
    expect(await storage.readEvents()).toEqual([
      { kind: "node", node: node("TASK-1") },
      { kind: "node", node: node("TASK-2") },
      { kind: "edge", edge: { source: "TASK-2", type: "supports", target: "TASK-1" } },
      {
        kind: "edge",
        edge: { source: "TASK-2", type: "supports", target: "TASK-1" },
        tombstone: true,
      },
    ]);
  });
});
