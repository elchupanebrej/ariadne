import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EdgeSchema } from "../../src/core/schemas/edges.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";
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
  it("isolates candidates, runs the same command, and returns linked evidence", async () => {
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
  });

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
