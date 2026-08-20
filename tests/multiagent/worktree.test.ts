import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EdgeSchema } from "../../src/core/schemas/edges.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";
import { GraphStorage } from "../../src/graph/storage.js";
import {
  WorktreeManager,
} from "../../src/multiagent/worktree-manager.js";

const run = promisify(execFile);

const git = async (cwd: string, ...args: string[]) =>
  run("git", args, { cwd });

const repository = async () => {
  const root = await mkdtemp(join(tmpdir(), "ariadne-worktree-repo-"));
  await git(root, "init", "-q");
  await git(root, "config", "user.email", "test@example.com");
  await git(root, "config", "user.name", "Ariadne Test");
  await writeFile(join(root, "README.md"), "seed\n");
  await git(root, "add", "README.md");
  await git(root, "commit", "-qm", "seed");
  return root;
};

const managerFor = (repoRoot: string) =>
  new WorktreeManager({
    repoRoot,
    worktreeRoot: join(repoRoot, ".ariadne", "worktrees"),
    depthMode: "Deep",
  });

describe("WorktreeManager", () => {
  it(
    "isolates candidates, runs the same command, and returns linked evidence",
    { timeout: 10_000 },
    async () => {
      const repoRoot = await repository();
      try {
        const manager = managerFor(repoRoot);
        const first = await manager.create("CAN-01-raft");
        const second = await manager.create("CAN-02-crdt");

        expect(first.path).not.toBe(second.path);
        expect(first.branch).not.toBe(second.branch);
        expect(first.path).toContain(join(".ariadne", "worktrees"));

        const args = ["-e", "process.stdout.write(process.cwd())"];
        const [firstRun, secondRun] = await Promise.all([
          manager.run(first, process.execPath, args),
          manager.run(second, process.execPath, args),
        ]);

        expect(firstRun.exitCode).toBe(0);
        expect(secondRun.exitCode).toBe(0);
        expect(firstRun.stdout).toBe(first.path);
        expect(secondRun.stdout).toBe(second.path);
        expect(firstRun.durationMs).toBeGreaterThanOrEqual(0);
        expect(NodeSchema.parse(firstRun.evidence)).toMatchObject({
          id: expect.stringMatching(/^EVD-/),
          type: "EVD",
          provenance_type: "MEASURED",
          candidate_id: "CAN-01-raft",
          stdout: first.path,
          exit_code: 0,
        });
        expect(EdgeSchema.parse(firstRun.edge)).toEqual({
          source: firstRun.evidence.id,
          target: "CAN-01-raft",
          type: "tests",
        });
      } finally {
        await rm(repoRoot, { recursive: true, force: true });
      }
    },
  );

  it("captures failed command logs without invoking a shell", async () => {
    const repoRoot = await repository();
    try {
      const manager = managerFor(repoRoot);
      const candidate = await manager.create("CAN-01-raft");
      const result = await manager.run(candidate, process.execPath, [
        "-e",
        "process.stderr.write(process.argv[1]); process.exit(3)",
        "shell ; must stay an argument",
      ]);

      expect(result.exitCode).toBe(3);
      expect(result.stderr).toBe("shell ; must stay an argument");
      expect(result.evidence.status).toBe("FAILED");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("terminates commands that exceed the configured timeout", async () => {
    const repoRoot = await repository();
    try {
      const manager = managerFor(repoRoot);
      const candidate = await manager.create("CAN-01-timeout");
      const result = await manager.run(
        candidate,
        process.execPath,
        ["-e", "setTimeout(() => {}, 10000)"],
        { timeoutMs: 50 },
      );

      expect(result.timedOut).toBe(true);
      expect(result.aborted).toBe(false);
      expect(result.exitCode).toBeNull();
      expect(result.evidence).toMatchObject({ timed_out: true, aborted: false });
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("requires a candidate path to be an actual registered worktree", async () => {
    const repoRoot = await repository();
    try {
      const manager = managerFor(repoRoot);
      const path = join(repoRoot, ".ariadne", "worktrees", "CAN-plain");
      await mkdir(path, { recursive: true });

      await expect(manager.run("CAN-plain", process.execPath, [])).rejects.toThrow(
        /registered worktree/i,
      );
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("does not start or continue an invalidated candidate", async () => {
    const repoRoot = await repository();
    try {
      const storage = new GraphStorage(join(repoRoot, ".ariadne"));
      const manager = new WorktreeManager({
        repoRoot,
        worktreeRoot: join(repoRoot, ".ariadne", "worktrees"),
        depthMode: "Deep",
        storage,
      });
      const candidate = await manager.create("CAN-01-abort");
      await storage.appendNode({
        id: candidate.candidateId,
        type: "CAN",
        provenance_type: "PROPOSED",
        statement: "candidate",
        status: "ACTIVE",
      });
      const invalidation = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          void storage
            .appendNode({
              id: candidate.candidateId,
              type: "CAN",
              provenance_type: "PROPOSED",
              statement: "candidate",
              status: "INVALIDATED",
            })
            .then(() => resolve())
            .catch(reject);
        }, 100);
      });

      await expect(
        manager.run(candidate, process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(/invalidated/i);
      await invalidation;
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("parses TAP receipts and keeps MSI metrics without upgrading the rung", async () => {
    const repoRoot = await repository();
    try {
      const manager = managerFor(repoRoot);
      const candidate = await manager.create("CAN-01-raft");
      const result = await manager.run(candidate, process.execPath, [
        "-e",
        "process.stdout.write('TAP version 13\\n1..2\\nok 1 - first\\nnot ok 2 - second\\nMSI: 81\\n')",
      ]);

      expect(result.evidence).toMatchObject({
        status: "FAILED",
        verdict: "FALSIFIED",
        method: "tap-receipt",
        receipt: {
          format: "tap",
          verdict: "FALSIFIED",
          metrics: { mutation_score_indicator: 81 },
        },
      });
      expect(result.evidence.rung).toBe(3);
      expect(result.evidence.stdout).toContain("not ok 2");
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("removes only the requested worktree and keeps its branch by default", async () => {
    const repoRoot = await repository();
    try {
      const manager = managerFor(repoRoot);
      const first = await manager.create("CAN-01-raft");
      const second = await manager.create("CAN-02-crdt");

      await manager.cleanup(first);
      await expect(readFile(first.path, "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(readFile(join(second.path, "README.md"), "utf8")).resolves.toBe(
        "seed\n",
      );
      expect((await git(repoRoot, "branch", "--list", first.branch)).stdout).toContain(
        first.branch,
      );
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it("refuses non-Deep and GSD workspaces and invalid candidate IDs", async () => {
    const repoRoot = await repository();
    try {
      expect(
        () =>
          new WorktreeManager({
            repoRoot,
            worktreeRoot: join(repoRoot, "worktrees"),
            depthMode: "Standard",
          }),
      ).toThrow(/Deep/i);
      await mkdir(join(repoRoot, ".planning"));
      expect(() => managerFor(repoRoot)).toThrow(/\.planning|GSD/i);

      await rm(join(repoRoot, ".planning"), { recursive: true, force: true });
      const manager = managerFor(repoRoot);
      await expect(manager.create("TASK-001")).rejects.toThrow(/CAN-/i);
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
