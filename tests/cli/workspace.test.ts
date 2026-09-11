import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { resolveCliWorkspace } from "../../src/cli/workspace.js";

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

const withWorkspace = async <T>(run: (cwd: string) => Promise<T>): Promise<T> => {
  const cwd = await mkdtemp(join(tmpdir(), "ariadne-cli-workspace-"));
  try {
    await mkdir(join(cwd, ".ariadne"), { recursive: true });
    return await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};

describe("resolveCliWorkspace", () => {
  it("returns the environment, engine handle, and legacy storage handle over one root", async () => {
    await withWorkspace(async (cwd) => {
      const stdout = capture();
      const stderr = capture();

      const { environment, graph, storage } = await resolveCliWorkspace({
        cwd,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(environment.storageRoot).toBe(join(cwd, ".ariadne"));
      expect(storage.rootDirectory).toBe(environment.storageRoot);

      await graph.addNode("TASK", "TASK-1", "Engine write", {
        provenance_type: "FACT",
        statement: "Engine write",
      });
      expect((await storage.materialize()).nodes.map(({ id }) => id)).toEqual(["TASK-1"]);

      await storage.appendNode({
        type: "TASK",
        id: "TASK-2",
        provenance_type: "FACT",
        statement: "Legacy write",
      });
      expect((await graph.listNodes()).map(({ id }) => id)).toEqual(["TASK-1", "TASK-2"]);
    });
  });
});
