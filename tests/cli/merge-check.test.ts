import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { GraphStorage } from "../../src/graph/storage.js";

const exec = promisify(execFile);

const git = async (cwd: string, ...args: string[]): Promise<string> =>
  (await exec("git", args, { cwd })).stdout;

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

const workspace = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "ariadne-merge-check-"));

const sharedNode = (statement: string): string =>
  JSON.stringify({
    kind: "node",
    node: {
      id: "TASK-SHARED",
      type: "TASK",
      provenance_type: "PROPOSED",
      statement,
    },
  });

describe("ariadne merge-check", () => {
  it("blocks publication with stable conflict-card links and does not mutate", async () => {
    const cwd = await workspace();
    try {
      const storage = new GraphStorage(join(cwd, ".ariadne"));
      await storage.appendNode({
        id: "CTR-MERGE-1",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Branches disagree",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      const before = await Promise.all([
        readFile(join(cwd, ".ariadne", "GRAPH.jsonl"), "utf8"),
        readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8"),
        readFile(join(cwd, ".ariadne", "cards", "CTR-MERGE-1.md"), "utf8"),
      ]);

      const result = await invoke(cwd, ["merge-check", "--json"]);
      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toEqual({
        check: "publication",
        passed: false,
        unresolved_conflicts: [
          { id: "CTR-MERGE-1", card: ".ariadne/cards/CTR-MERGE-1.md" },
        ],
        diagnostics: [
          expect.objectContaining({
            code: "UNRESOLVED_MERGE_CONTRADICTION",
            nodeId: "CTR-MERGE-1",
            card: ".ariadne/cards/CTR-MERGE-1.md",
          }),
        ],
      });
      expect(
        await Promise.all([
          readFile(join(cwd, ".ariadne", "GRAPH.jsonl"), "utf8"),
          readFile(join(cwd, ".ariadne", "INDEX.md"), "utf8"),
          readFile(join(cwd, ".ariadne", "cards", "CTR-MERGE-1.md"), "utf8"),
        ]),
      ).toEqual(before);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("passes after resolution and ignores unrelated contradiction kinds", async () => {
    const cwd = await workspace();
    try {
      const storage = new GraphStorage(join(cwd, ".ariadne"));
      await storage.appendNode({
        id: "CTR-OTHER-1",
        type: "CTR",
        provenance_type: "PROPOSED",
        statement: "An unrelated contradiction",
        status: "ACTIVE",
        conflict_kind: "evidence",
      });
      await storage.appendNode({
        id: "CTR-MERGE-2",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Branches disagree",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      expect((await invoke(cwd, ["merge-check"])).code).toBe(1);

      await storage.appendNode({
        id: "CTR-MERGE-2",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Branches disagree",
        status: "RESOLVED",
        conflict_kind: "branch_merge",
      });
      const result = await invoke(cwd, ["merge-check", "--json"]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        check: "publication",
        passed: true,
        unresolved_conflicts: [],
        diagnostics: [],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("allows a valid divergent merge and commit while publication remains blocked", async () => {
    const repo = await workspace();
    try {
      await git(repo, "init", "-q");
      await git(repo, "config", "user.email", "test@example.com");
      await git(repo, "config", "user.name", "Ariadne Test");
      await mkdir(join(repo, ".ariadne"));
      await writeFile(
        join(repo, ".gitattributes"),
        ".ariadne/GRAPH.jsonl merge=ariadne\n",
      );
      await writeFile(
        join(repo, ".ariadne", "GRAPH.jsonl"),
        `${sharedNode("base")}\n`,
      );
      await git(repo, "add", ".gitattributes", ".ariadne/GRAPH.jsonl");
      await git(repo, "commit", "-qm", "base");

      const cliPath = fileURLToPath(
        new URL("../../dist/cli/index.js", import.meta.url),
      ).replaceAll("\\", "/");
      await git(
        repo,
        "config",
        "merge.ariadne.driver",
        `${process.execPath.replaceAll("\\", "/")} ${cliPath} merge-driver --protocol-version 1 %O %A %B`,
      );
      await git(repo, "checkout", "-qb", "current");
      await writeFile(
        join(repo, ".ariadne", "GRAPH.jsonl"),
        `${sharedNode("current")}\n`,
      );
      await git(repo, "add", ".ariadne/GRAPH.jsonl");
      await git(repo, "commit", "-qm", "current change");

      await git(repo, "checkout", "-qb", "incoming", "HEAD~1");
      await writeFile(
        join(repo, ".ariadne", "GRAPH.jsonl"),
        `${sharedNode("incoming")}\n`,
      );
      await git(repo, "add", ".ariadne/GRAPH.jsonl");
      await git(repo, "commit", "-qm", "incoming change");
      await git(repo, "checkout", "current");
      await git(repo, "merge", "incoming", "--no-edit");

      const storage = new GraphStorage(join(repo, ".ariadne"));
      await storage.regenerateIndex();
      await git(repo, "add", ".ariadne");
      await git(repo, "commit", "-qm", "merge divergent graph");
      const status = await git(repo, "status", "--short");
      expect(status).toBe("");

      const result = await invoke(repo, ["merge-check", "--json"]);
      expect(result.code).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        check: "publication",
        passed: false,
        diagnostics: [
          expect.objectContaining({
            code: "UNRESOLVED_MERGE_CONTRADICTION",
            card: expect.stringMatching(/^\.ariadne\/cards\/CTR-merge-/u),
          }),
        ],
      });
    } finally {
      await rm(repo, { recursive: true, force: true });
    }
  }, 15_000);
});
