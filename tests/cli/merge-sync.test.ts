import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
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

const node = (id: string, type = "TASK") => ({
  id,
  type,
  provenance_type: type === "UNK" ? "UNKNOWN" : "FACT",
  statement: id,
});

describe("ariadne merge-sync", () => {
  it("rebuilds projections idempotently and stages only derived files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-merge-sync-"));
    try {
      await git(root, "init", "-q");
      const storage = new GraphStorage(join(root, ".ariadne"));
      await storage.appendEvents([
        { kind: "node", node: node("TASK-OPEN") },
        { kind: "node", node: node("UNK-OPEN", "UNK") },
      ]);
      await writeFile(join(root, ".ariadne", "INDEX.md"), "stale index\n");
      await writeFile(
        join(root, ".ariadne", "cards", "TASK-STALE.md"),
        "stale card\n",
      );
      await writeFile(
        join(root, ".ariadne", "cards", "HOST-NOTE.txt"),
        "host-owned note\n",
      );
      await storage.writeState({
        host_owned: { keep: true },
        frontier: ["TASK-STALE"],
      });
      await git(root, "add", ".ariadne/STATE.yaml");

      const first = await invoke(root, [
        "merge-sync",
        "--json",
        "--stage-derived",
      ]);
      expect(first.code).toBe(0);
      const receipt = JSON.parse(first.stdout) as {
        generated: { index: string; cards: string; state: string };
        staged: string[];
      };
      expect(receipt.generated).toEqual({
        index: ".ariadne/INDEX.md",
        cards: ".ariadne/cards",
        state: ".ariadne/STATE.yaml",
      });
      expect(receipt.staged).toEqual([".ariadne/INDEX.md", ".ariadne/cards"]);
      expect(
        await readFile(join(root, ".ariadne", "INDEX.md"), "utf8"),
      ).toContain("TASK-OPEN");
      await expect(
        readFile(join(root, ".ariadne", "cards", "TASK-STALE.md")),
      ).rejects.toThrow();
      expect(
        JSON.parse(
          await readFile(join(root, ".ariadne", "STATE.yaml"), "utf8"),
        ),
      ).toMatchObject({
        host_owned: { keep: true },
        frontier: ["TASK-OPEN", "UNK-OPEN"],
        open_unknowns: ["UNK-OPEN"],
      });
      expect(await git(root, "diff", "--cached", "--name-only")).toBe(
        ".ariadne/INDEX.md\n.ariadne/cards/TASK-OPEN.md\n.ariadne/cards/UNK-OPEN.md\n",
      );
      expect(await git(root, "status", "--porcelain")).toContain(
        "?? .ariadne/cards/HOST-NOTE.txt",
      );

      const before = await Promise.all([
        readFile(join(root, ".ariadne", "INDEX.md"), "utf8"),
        readFile(join(root, ".ariadne", "STATE.yaml"), "utf8"),
      ]);
      const secondJson = await invoke(root, ["merge-sync", "--json"]);
      expect(secondJson.code).toBe(0);
      expect(secondJson.stdout).toContain('"state_changed": false');
      const second = await invoke(root, ["merge-sync"]);
      expect(second.stdout).toContain(
        "State projection unchanged in working tree only: .ariadne/STATE.yaml",
      );
      expect(
        await Promise.all([
          readFile(join(root, ".ariadne", "INDEX.md"), "utf8"),
          readFile(join(root, ".ariadne", "STATE.yaml"), "utf8"),
        ]),
      ).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("uses the GSD overlay for every projection", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-merge-sync-gsd-"));
    try {
      await mkdir(join(root, ".planning", "ariadne"), { recursive: true });
      const storage = new GraphStorage(join(root, ".planning", "ariadne"));
      await storage.appendNode(node("TASK-GSD"));

      const result = await invoke(root, ["merge-sync", "--json"]);
      expect(result.code).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        generated: {
          index: ".planning/ariadne/INDEX.md",
          cards: ".planning/ariadne/cards",
          state: ".planning/ariadne/STATE.yaml",
        },
      });
      expect(
        await readFile(join(root, ".planning", "ariadne", "INDEX.md"), "utf8"),
      ).toContain("TASK-GSD");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("prints a usable conflict-card link and reconciliation guidance", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-merge-sync-conflict-"));
    try {
      const storage = new GraphStorage(join(root, ".ariadne"));
      await storage.appendNode({
        id: "CTR-MERGE-LINK",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Branches diverged",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
        reconciliation_guidance: "Select a stored variant after review.",
      });

      const result = await invoke(root, ["merge-sync"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain(
        "[CTR-MERGE-LINK](.ariadne/cards/CTR-MERGE-LINK.md)",
      );
      expect(result.stdout).toContain("Select a stored variant after review.");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps unchanged cards byte-identical when synchronization runs on another day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T09:00:00.000Z"));
    const root = await mkdtemp(join(tmpdir(), "ariadne-merge-sync-idempotent-"));
    try {
      const storage = new GraphStorage(join(root, ".ariadne"));
      await storage.appendNode(node("TASK-STABLE"));
      await invoke(root, ["merge-sync"]);
      const before = await readFile(
        join(root, ".ariadne", "cards", "TASK-STABLE.md"),
        "utf8",
      );

      vi.setSystemTime(new Date("2026-09-04T09:00:00.000Z"));
      expect((await invoke(root, ["merge-sync"])).code).toBe(0);

      expect(
        await readFile(
          join(root, ".ariadne", "cards", "TASK-STABLE.md"),
          "utf8",
        ),
      ).toBe(before);
    } finally {
      vi.useRealTimers();
      await rm(root, { recursive: true, force: true });
    }
  });
});
