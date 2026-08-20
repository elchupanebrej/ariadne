import { existsSync, mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

const workspace = () => mkdtempSync(join(tmpdir(), "ariadne-cli-node-"));

const addAssumption = async (cwd: string, id: string) => {
  const stdout = capture();
  const stderr = capture();
  const code = await runCli(
    [
      "node",
      "add",
      "ASM",
      id,
      "--title",
      "Check capacity",
      "--payload",
      JSON.stringify({
        provenance_type: "ASSUMED",
        statement: "The service can meet the target capacity",
      }),
    ],
    { cwd, stdout: stdout.stream, stderr: stderr.stream },
  );
  return { code, stdout, stderr };
};

describe("ariadne node", () => {
  it("adds a validated node and regenerates the public index", async () => {
    const cwd = workspace();
    const result = await addAssumption(cwd, "ASM-1");

    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout.text())).toMatchObject({
      id: "ASM-1",
      type: "ASM",
      title: "Check capacity",
      provenance_type: "ASSUMED",
    });

    const storage = new GraphStorage(join(cwd, ".ariadne"));
    const events = await storage.readEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "node", node: { id: "ASM-1" } });
    await expect(readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8")).resolves.toContain(
      "ASM-1",
    );
  });

  it("gets nodes and filters list results by type and provenance", async () => {
    const cwd = workspace();
    await addAssumption(cwd, "ASM-1");
    const can = capture();
    const canErr = capture();
    expect(
      await runCli(
        [
          "node",
          "add",
          "CAN",
          "CAN-1",
          "--title",
          "Candidate",
          "--payload",
          JSON.stringify({
            provenance_type: "PROPOSED",
            statement: "Candidate mechanism",
          }),
        ],
        { cwd, stdout: can.stream, stderr: canErr.stream },
      ),
    ).toBe(0);

    const get = capture();
    expect(await runCli(["node", "get", "ASM-1"], { cwd, stdout: get.stream, stderr: capture().stream })).toBe(0);
    expect(JSON.parse(get.text())).toMatchObject({ id: "ASM-1", provenance_type: "ASSUMED" });

    const list = capture();
    expect(
      await runCli(
        ["node", "list", "--type", "ASM", "--provenance", "ASSUMED"],
        { cwd, stdout: list.stream, stderr: capture().stream },
      ),
    ).toBe(0);
    expect(JSON.parse(list.text()).map((node: { id: string }) => node.id)).toEqual(["ASM-1"]);
  });

  it("removes by appending a tombstone and hides it from the default list", async () => {
    const cwd = workspace();
    await addAssumption(cwd, "ASM-1");
    const stdout = capture();
    const stderr = capture();

    expect(await runCli(["node", "remove", "ASM-1"], { cwd, stdout: stdout.stream, stderr: stderr.stream })).toBe(0);
    expect(JSON.parse(stdout.text())).toMatchObject({ id: "ASM-1", status: "REMOVED" });

    const storage = new GraphStorage(join(cwd, ".ariadne"));
    const events = await storage.readEvents();
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: "node", node: { id: "ASM-1", status: "REMOVED" } });

    const list = capture();
    expect(await runCli(["node", "list"], { cwd, stdout: list.stream, stderr: capture().stream })).toBe(0);
    expect(JSON.parse(list.text())).toEqual([]);
  });

  it("rejects invalid node payloads without writing graph state", async () => {
    const cwd = workspace();
    const stdout = capture();
    const stderr = capture();

    expect(
      await runCli(
        ["node", "add", "ASM", "not-an-asm-id", "--title", "Invalid", "--payload", "{}"],
        { cwd, stdout: stdout.stream, stderr: stderr.stream },
      ),
    ).toBe(1);
    expect(stderr.text()).toContain("Error:");
    expect(existsSync(join(cwd, ".ariadne", "GRAPH.jsonl"))).toBe(false);
  });
});
