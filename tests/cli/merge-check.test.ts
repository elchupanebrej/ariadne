import { mkdtemp, readFile, rm } from "node:fs/promises";
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

const workspace = async (): Promise<string> =>
  mkdtemp(join(tmpdir(), "ariadne-merge-check-"));

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
});
