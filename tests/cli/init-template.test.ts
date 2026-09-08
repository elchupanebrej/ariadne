import { access, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";

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

const workspace = async () => mkdtemp(join(tmpdir(), "ariadne-cli-init-"));

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

describe("ariadne init", () => {
  it("initializes standalone storage with valid state, empty graph, and index", async () => {
    const cwd = await workspace();
    const result = await invoke(cwd, ["init", "--mode", "standalone"]);
    const root = join(cwd, ".ariadne");

    expect(result.code).toBe(0);
    // DEC-RPT-06: emitted paths are project-root-relative.
    expect(JSON.parse(result.stdout.text())).toMatchObject({
      mode: "standalone",
      storage_root: ".ariadne",
    });
    expect(JSON.parse(await readFile(join(root, "STATE.yaml"), "utf8"))).toMatchObject({
      mode: "standalone",
      depth_mode: "Standard",
    });
    expect(await readFile(join(root, "GRAPH.jsonl"), "utf8")).toBe("");
    expect(await readFile(join(root, "INDEX.md"), "utf8")).toContain("# Ariadne Epistemic Index");
  });

  it("uses the GSD overlay in auto and rejects shadow state", async () => {
    const cwd = await workspace();
    await mkdir(join(cwd, ".planning"), { recursive: true });
    const auto = await invoke(cwd, ["init"]);
    expect(auto.code).toBe(0);
    expect(JSON.parse(auto.stdout.text())).toMatchObject({
      mode: "gsd",
      storage_root: ".planning/ariadne",
    });

    const shadowed = await workspace();
    await mkdir(join(shadowed, ".planning", "ariadne"), { recursive: true });
    await writeFile(join(shadowed, ".planning", "ariadne", "STATE.md"), "shadow\n", "utf8");
    const rejected = await invoke(shadowed, ["init", "--mode", "gsd"]);
    expect(rejected.code).toBe(2);
    expect(rejected.stderr.text()).toContain("shadow state");
    expect(await exists(join(shadowed, ".planning", "ariadne", "STATE.yaml"))).toBe(false);
  });

  it("refuses repeat initialization and force overwrites only managed files", async () => {
    const cwd = await workspace();
    const root = join(cwd, ".ariadne");
    expect((await invoke(cwd, ["init"])).code).toBe(0);
    await writeFile(join(root, "STATE.yaml"), "{\"custom\":true}\n", "utf8");
    await writeFile(join(root, "KEEP.txt"), "keep\n", "utf8");

    const refused = await invoke(cwd, ["init"]);
    expect(refused.code).toBe(2);
    expect(refused.stderr.text()).toContain("--force");
    expect(await readFile(join(root, "STATE.yaml"), "utf8")).toContain("custom");

    const forced = await invoke(cwd, ["init", "--force"]);
    expect(forced.code).toBe(0);
    expect(await readFile(join(root, "STATE.yaml"), "utf8")).toContain('"mode": "standalone"');
    expect(await readFile(join(root, "KEEP.txt"), "utf8")).toBe("keep\n");
  });
});

describe("ariadne template", () => {
  it.each([
    ["FRAME", ["# FRAME-", "## 1. Request Deconstruction", "Behavioral Specification"]],
    ["DIAG", ["# DIAG-", "OBS-", "HYP-", "CTR-"]],
    ["LEAN-TASK", ["# LEAN-TASK-", "## 1. Task Passport & Invariants", "Verification"]],
    ["TRANS", ["# TRANS-", "Current State", "Target State", "Rollback"]],
  ] as const)("prints a compliant %s card without initializing storage", async (type, markers) => {
    const cwd = await workspace();
    const result = await invoke(cwd, ["template", type]);

    expect(result.code).toBe(0);
    for (const marker of markers) expect(result.stdout.text()).toContain(marker);
    expect(await exists(join(cwd, ".ariadne"))).toBe(false);
  });
});
