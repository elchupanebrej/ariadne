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
  it("returns the environment and a single engine handle over one root", async () => {
    await withWorkspace(async (cwd) => {
      const stdout = capture();
      const stderr = capture();

      const workspace = await resolveCliWorkspace({
        cwd,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(Object.keys(workspace).sort()).toEqual(["environment", "graph"]);
      expect(workspace.environment.storageRoot).toBe(join(cwd, ".ariadne"));

      await workspace.graph.addNode("TASK", "TASK-1", "Engine write", {
        provenance_type: "FACT",
        statement: "Engine write",
      });
      expect((await workspace.graph.listNodes()).map(({ id }) => id)).toEqual(["TASK-1"]);
    });
  });
});
