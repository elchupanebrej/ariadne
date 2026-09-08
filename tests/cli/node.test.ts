import { existsSync, mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { NODE_TYPES } from "../../src/core/schemas/nodes.js";
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

  it("enumerates valid node types in errors and add help", async () => {
    const cwd = workspace();
    const typeList = NODE_TYPES.join(", ");

    const addErr = capture();
    expect(
      await runCli(
        ["node", "add", "frame", "FRAME-1", "--title", "T", "--payload", "{}"],
        { cwd, stdout: capture().stream, stderr: addErr.stream },
      ),
    ).toBe(2);
    expect(addErr.text()).toContain("Unknown node type: frame");
    expect(addErr.text()).toContain(typeList);
    expect(addErr.text()).toContain("uppercase");

    const listErr = capture();
    expect(
      await runCli(["node", "list", "--type", "frame"], { cwd, stdout: capture().stream, stderr: listErr.stream }),
    ).toBe(2);
    expect(listErr.text()).toContain("Unknown node type: frame");
    expect(listErr.text()).toContain(typeList);

    const help = capture();
    expect(await runCli(["node", "add", "--help"], { cwd, stdout: help.stream, stderr: capture().stream })).toBe(0);
    expect(help.text()).toContain(typeList);
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
    ).toBe(2);
    expect(stderr.text()).toContain("Error:");
    expect(existsSync(join(cwd, ".ariadne", "GRAPH.jsonl"))).toBe(false);
  });

  it("atomically updates an existing node without appending a REMOVED event", async () => {
    const cwd = workspace();
    await addAssumption(cwd, "ASM-1");

    const stdout = capture();
    const stderr = capture();
    const code = await runCli(
      [
        "node",
        "update",
        "ASM-1",
        "--title",
        "Updated capacity",
        "--payload",
        JSON.stringify({
          provenance_type: "ASSUMED",
          statement: "The service capacity has been verified under stress",
        }),
      ],
      { cwd, stdout: stdout.stream, stderr: stderr.stream },
    );

    expect(code).toBe(0);
    expect(JSON.parse(stdout.text())).toMatchObject({
      id: "ASM-1",
      type: "ASM",
      title: "Updated capacity",
      statement: "The service capacity has been verified under stress",
      provenance_type: "ASSUMED",
    });

    const storage = new GraphStorage(join(cwd, ".ariadne"));
    const events = await storage.readEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: "node", node: { id: "ASM-1", title: "Check capacity" } });
    expect(events[1]).toMatchObject({ kind: "node", node: { id: "ASM-1", title: "Updated capacity" } });
    expect(events.some((e) => "node" in e && e.node.status === "REMOVED")).toBe(false);

    const get = capture();
    expect(await runCli(["node", "get", "ASM-1"], { cwd, stdout: get.stream, stderr: capture().stream })).toBe(0);
    expect(JSON.parse(get.text())).toMatchObject({
      id: "ASM-1",
      title: "Updated capacity",
      statement: "The service capacity has been verified under stress",
    });

    await expect(readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8")).resolves.toContain(
      "The service capacity has been verified under stress",
    );
  });

  it("rejects invalid node updates without mutating events, index, or state", async () => {
    const cwd = workspace();
    await addAssumption(cwd, "ASM-1");

    const storage = new GraphStorage(join(cwd, ".ariadne"));
    const initialEvents = await storage.readEvents();
    const initialIndex = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");

    // 1. Non-existent node
    const notFoundErr = capture();
    expect(
      await runCli(
        ["node", "update", "ASM-999", "--payload", JSON.stringify({ provenance_type: "ASSUMED", statement: "x" })],
        { cwd, stdout: capture().stream, stderr: notFoundErr.stream },
      ),
    ).toBe(2);
    expect(notFoundErr.text()).toContain("Node not found: ASM-999");

    // 2. Invalid JSON
    const invalidJsonErr = capture();
    expect(
      await runCli(
        ["node", "update", "ASM-1", "--payload", "{bad json"],
        { cwd, stdout: capture().stream, stderr: invalidJsonErr.stream },
      ),
    ).toBe(2);
    expect(invalidJsonErr.text()).toContain("Invalid --payload JSON");

    // 3. Schema violation (invalid provenance type)
    const schemaErr = capture();
    expect(
      await runCli(
        ["node", "update", "ASM-1", "--payload", JSON.stringify({ provenance_type: "INVALID_PROV" })],
        { cwd, stdout: capture().stream, stderr: schemaErr.stream },
      ),
    ).toBe(2);
    expect(schemaErr.text()).toContain("Error:");

    // 4. Attempted id change
    const idChangeErr = capture();
    expect(
      await runCli(
        ["node", "update", "ASM-1", "--payload", JSON.stringify({ id: "ASM-2", provenance_type: "ASSUMED" })],
        { cwd, stdout: capture().stream, stderr: idChangeErr.stream },
      ),
    ).toBe(2);
    expect(idChangeErr.text()).toContain("Cannot change node id");

    // 5. Attempted type change
    const typeChangeErr = capture();
    expect(
      await runCli(
        ["node", "update", "ASM-1", "--payload", JSON.stringify({ type: "CAN", provenance_type: "PROPOSED" })],
        { cwd, stdout: capture().stream, stderr: typeChangeErr.stream },
      ),
    ).toBe(2);
    expect(typeChangeErr.text()).toContain("Cannot change node type");

    // Verify storage remained completely unmodified
    const eventsAfter = await storage.readEvents();
    expect(eventsAfter).toEqual(initialEvents);
    const indexAfter = await readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8");
    expect(indexAfter).toBe(initialIndex);
  });
});
