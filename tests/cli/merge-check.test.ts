import { execFile } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/index.js";
import { createFramedRecord } from "../../src/graph/journal.js";
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

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const sharedNode = (statement: string, sequence = 1): string =>
  JSON.stringify(
    createFramedRecord({
      sequence,
      payload: {
        kind: "node",
        node: {
          id: "TASK-SHARED",
          type: "TASK",
          provenance_type: "PROPOSED",
          statement,
        },
      },
    }),
  );

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

      const human = await invoke(cwd, ["merge-check"]);
      expect(human.code).toBe(1);
      expect(human.stdout).toContain("Ariadne publication check: blocked");
      expect(human.stdout).toContain(".ariadne/cards/CTR-MERGE-1.md");
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

  it("emits deterministic structured output and filters only unresolved branch merges", async () => {
    const cwd = await workspace();
    try {
      const storage = new GraphStorage(join(cwd, ".ariadne"));
      await storage.appendNode({
        id: "CTR-MERGE-Z",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Later branch disagreement",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      await storage.appendNode({
        id: "CTR-MERGE-A",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Earlier branch disagreement",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      await storage.appendNode({
        id: "CTR-MERGE-RESOLVED",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Resolved branch disagreement",
        status: "RESOLVED",
        conflict_kind: "branch_merge",
      });
      await storage.appendNode({
        id: "CTR-OTHER-MERGE",
        type: "CTR",
        provenance_type: "FACT",
        statement: "Non-merge contradiction",
        status: "MERGE_CONFLICT",
        conflict_kind: "evidence",
      });
      await storage.appendNode({
        id: "TASK-MERGE-FALSE",
        type: "TASK",
        provenance_type: "FACT",
        statement: "A non-contradiction with merge fields",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });

      const first = await invoke(cwd, ["merge-check", "--json"]);
      const second = await invoke(cwd, ["merge-check", "--json"]);

      expect(first.code).toBe(1);
      expect(second.code).toBe(1);
      expect(second.stdout).toBe(first.stdout);
      expect(JSON.parse(first.stdout)).toMatchObject({
        check: "publication",
        passed: false,
        unresolved_conflicts: [
          { id: "CTR-MERGE-A", card: ".ariadne/cards/CTR-MERGE-A.md" },
          { id: "CTR-MERGE-Z", card: ".ariadne/cards/CTR-MERGE-Z.md" },
        ],
        diagnostics: [
          expect.objectContaining({ nodeId: "CTR-MERGE-A" }),
          expect.objectContaining({ nodeId: "CTR-MERGE-Z" }),
        ],
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("does not change projections, state, notices, locks, or local Git policy", async () => {
    const cwd = await workspace();
    try {
      await git(cwd, "init", "-q");
      await git(cwd, "config", "merge.ariadne.sentinel", "unchanged");
      const storage = new GraphStorage(join(cwd, ".ariadne"));
      await storage.appendNode({
        id: "CTR-MERGE-READONLY",
        type: "CTR",
        provenance_type: "FACT",
        statement: "A publication-only conflict",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      const noticesPath = join(cwd, ".ariadne", "NOTICES.jsonl");
      await writeFile(noticesPath, "existing notice state\n", "utf8");
      const paths = [
        join(cwd, ".ariadne", "GRAPH.jsonl"),
        join(cwd, ".ariadne", "INDEX.md"),
        join(cwd, ".ariadne", "cards", "CTR-MERGE-READONLY.md"),
        join(cwd, ".ariadne", "STATE.yaml"),
        noticesPath,
      ];
      const before = await Promise.all(paths.map((path) => readFile(path, "utf8")));
      const gitPolicyBefore = await git(cwd, "config", "--local", "--get", "merge.ariadne.sentinel");
      const lockPaths = [
        join(cwd, ".ariadne", "GRAPH.jsonl.lock"),
        join(cwd, ".ariadne", "STATE.yaml.lock"),
      ];

      const result = await invoke(cwd, ["merge-check", "--json"]);

      expect(result.code).toBe(1);
      expect(await Promise.all(paths.map((path) => readFile(path, "utf8")))).toEqual(before);
      expect(await git(cwd, "config", "--local", "--get", "merge.ariadne.sentinel")).toBe(
        gitPolicyBefore,
      );
      expect(await Promise.all(lockPaths.map((path) => exists(path)))).toEqual([false, false]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });

  it("keeps publication, structural, semantic, and epistemic gates independent", async () => {
    const cwd = await workspace();
    try {
      const storage = new GraphStorage(join(cwd, ".ariadne"));
      await storage.appendNode({
        id: "CTR-MERGE-INDEPENDENT",
        type: "CTR",
        provenance_type: "FACT",
        statement: "A valid unresolved branch merge",
        status: "MERGE_CONFLICT",
        conflict_kind: "branch_merge",
      });
      await storage.appendNode({
        id: "EVDREQ-INDEPENDENT",
        type: "EVDREQ",
        provenance_type: "PROPOSED",
        statement: "An evidence request without a result",
        claim_class: "Algorithmic logic",
      });

      const publication = await invoke(cwd, ["merge-check", "--json"]);
      const structural = await invoke(cwd, ["gate", "structural"]);
      const semantic = await invoke(cwd, ["gate", "semantic"]);
      const epistemic = await invoke(cwd, ["gate", "epistemic"]);
      const all = await invoke(cwd, ["gate", "all"]);

      expect(publication.code).toBe(1);
      expect(JSON.parse(publication.stdout)).toMatchObject({
        check: "publication",
        passed: false,
        diagnostics: [expect.objectContaining({ nodeId: "CTR-MERGE-INDEPENDENT" })],
      });
      expect(structural.code).toBe(0);
      expect(semantic.code).toBe(0);
      expect(epistemic.code).toBe(1);
      expect(JSON.parse(epistemic.stdout)).toMatchObject({
        gate: "epistemic",
        passed: false,
        diagnostics: [
          expect.objectContaining({
            code: "MISSING_EVIDENCE_RESULT",
            nodeId: "EVDREQ-INDEPENDENT",
          }),
        ],
      });
      expect(JSON.parse(all.stdout)).toMatchObject({
        gate: "all",
        passed: false,
        results: [
          { gate: "structural", passed: true },
          { gate: "semantic", passed: true },
          { gate: "epistemic", passed: false },
        ],
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

      const semantic = await invoke(repo, ["gate", "semantic"]);
      const allGates = await invoke(repo, ["gate", "all"]);
      expect(semantic.code).toBe(0);
      expect(JSON.parse(semantic.stdout)).toMatchObject({
        gate: "semantic",
        passed: true,
        diagnostics: [],
      });
      expect(allGates.code).toBe(0);
      expect(JSON.parse(allGates.stdout)).toMatchObject({
        gate: "all",
        passed: true,
        results: [
          { gate: "structural", passed: true },
          { gate: "semantic", passed: true },
          { gate: "epistemic", passed: true },
        ],
      });

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
  }, 30_000);

  it("does not repair or truncate a malformed journal tail", async () => {
    const cwd = await workspace();
    try {
      const graphPath = join(cwd, ".ariadne", "GRAPH.jsonl");
      await mkdir(join(cwd, ".ariadne"));
      const malformed = `${sharedNode("base")}\n{"kind":"node"`;
      await writeFile(graphPath, malformed);

      const result = await invoke(cwd, ["merge-check", "--json"]);
      expect(result.code).toBe(1);
      expect(await readFile(graphPath, "utf8")).toBe(malformed);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
