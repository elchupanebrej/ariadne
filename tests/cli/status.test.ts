import { existsSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
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

const createWorkspace = async () => {
  const cwd = mkdtempSync(join(tmpdir(), "ariadne-cli-status-"));
  const storage = new GraphStorage(join(cwd, ".ariadne"));
  await storage.writeState({
    depth_mode: "Deep",
    frontier: ["CAN-1"],
    open_unknowns: ["UNK-1"],
  });
  await storage.appendNode({
    type: "CAN",
    id: "CAN-1",
    provenance_type: "PROPOSED",
    statement: "Use the candidate mechanism",
  });
  await storage.appendNode({
    type: "UNK",
    id: "UNK-1",
    provenance_type: "UNKNOWN",
    statement: "Required capacity is unknown",
  });
  return cwd;
};

describe("ariadne status", () => {
  it("renders the active depth mode, frontier, unknowns, and graph health", async () => {
    const cwd = await createWorkspace();
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["status"], {
      cwd,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(code).toBe(0);
    expect(stdout.text()).toContain("Depth mode: Deep");
    expect(stdout.text()).toContain("CAN-1");
    expect(stdout.text()).toContain("UNK-1");
    expect(stdout.text()).toContain("Graph health: healthy");
    expect(stderr.text()).toBe("");
  });

  it("renders parseable structured status JSON", async () => {
    const cwd = await createWorkspace();
    const stdout = capture();
    const stderr = capture();

    const code = await runCli(["status", "--json"], {
      cwd,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });
    const status = JSON.parse(stdout.text()) as {
      depth_mode: string;
      frontier: string[];
      open_unknowns: string[];
      graph_health: { healthy: boolean };
    };

    expect(code).toBe(0);
    expect(status.depth_mode).toBe("Deep");
    expect(status.frontier).toEqual(["CAN-1"]);
    expect(status.open_unknowns).toEqual(["UNK-1"]);
    expect(status.graph_health.healthy).toBe(true);
    expect(stderr.text()).toBe("");
  });

  it("runs the built executable when a build is available", async () => {
    const builtCli = resolve(
      fileURLToPath(new URL("../../dist/cli/index.js", import.meta.url)),
    );
    if (!existsSync(builtCli)) return;

    const result = await new Promise<{ code: number | null; stdout: string }>(
      (resolveResult, reject) => {
        const child = spawn(process.execPath, [builtCli, "--version"], {
          cwd: process.cwd(),
        });
        let output = "";
        child.stdout.on("data", (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.on("error", reject);
        child.on("close", (code) => resolveResult({ code, stdout: output }));
      },
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("0.1.0");
  });
});
