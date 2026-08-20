import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import type { EpistemicEdge } from "../core/schemas/edges.js";
import { EdgeSchema } from "../core/schemas/edges.js";
import type { Node } from "../core/schemas/nodes.js";
import { NodeSchema } from "../core/schemas/nodes.js";

const CANDIDATE_ID = /^CAN-[0-9A-Za-z_-]+$/;

export type WorktreeManagerOptions = {
  repoRoot?: string;
  repositoryRoot?: string;
  worktreeRoot?: string;
  depthMode?: string;
  depth?: string;
  mode?: string;
};

export type CandidateWorktree = {
  candidateId: string;
  branch: string;
  path: string;
};

export type WorktreeCleanupOptions = {
  /** Remove the branch only when it is already safely merged. */
  deleteBranch?: boolean;
  removeBranch?: boolean;
  /** Force removal of dirty worktree contents at this exact target. */
  force?: boolean;
};

export type WorktreeExecution = {
  candidateId: string;
  worktree: CandidateWorktree;
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  evidence: Node;
  /** Alias kept beside evidence for callers that treat this as an artifact. */
  node: Node;
  edge: EpistemicEdge;
};

type ProcessResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
};

const runProcess = (
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<ProcessResult> =>
  new Promise((resolveResult) => {
    const child = spawn(command, [...args], {
      cwd,
      shell: false,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      resolveResult({
        stdout,
        stderr,
        exitCode: null,
        signal: null,
        error,
      });
    });
    child.once("close", (exitCode, signal) => {
      resolveResult({ stdout, stderr, exitCode, signal });
    });
  });

const gitFailure = (args: readonly string[], result: ProcessResult): Error =>
  new Error(
    [
      `git ${args.join(" ")} failed`,
      result.error?.message,
      result.stderr.trim(),
    ]
      .filter(Boolean)
      .join(": "),
  );

const assertCandidateId = (candidateId: string): void => {
  if (!CANDIDATE_ID.test(candidateId)) {
    throw new Error(`Candidate ID must match CAN-*: ${candidateId}`);
  }
};

let evidenceSequence = 0;

export class WorktreeManager {
  readonly repoRoot: string;
  readonly worktreeRoot: string;

  constructor(options: WorktreeManagerOptions) {
    const repoRoot = options.repoRoot ?? options.repositoryRoot;
    if (!repoRoot) throw new Error("A repository root is required");

    const depthMode = options.depthMode ?? options.depth ?? options.mode;
    if (depthMode !== "Deep") {
      throw new Error("Candidate worktrees require Deep depth mode");
    }

    this.repoRoot = resolve(repoRoot);
    this.worktreeRoot = resolve(
      options.worktreeRoot ?? join(this.repoRoot, ".ariadne", "worktrees"),
    );
    this.assertDeepStandalone();
  }

  private assertDeepStandalone(): void {
    if (existsSync(join(this.repoRoot, ".planning"))) {
      throw new Error("Candidate worktrees are unavailable in GSD (.planning) mode");
    }
  }

  private descriptor(candidateId: string): CandidateWorktree {
    assertCandidateId(candidateId);
    return {
      candidateId,
      branch: `ariadne/${candidateId}`,
      path: join(this.worktreeRoot, candidateId),
    };
  }

  private resolveWorktree(candidate: CandidateWorktree | string): CandidateWorktree {
    const expected =
      typeof candidate === "string"
        ? this.descriptor(candidate)
        : this.descriptor(candidate.candidateId);
    if (
      typeof candidate !== "string" &&
      (resolve(candidate.path) !== expected.path || candidate.branch !== expected.branch)
    ) {
      throw new Error(`Worktree does not match candidate ${expected.candidateId}`);
    }
    return expected;
  }

  private assertManagedPath(path: string): void {
    const target = resolve(path);
    const parent = dirname(target);
    if (parent !== this.worktreeRoot || relative(this.worktreeRoot, target).startsWith("..")) {
      throw new Error(`Worktree target is outside the configured root: ${path}`);
    }
  }

  private async git(args: readonly string[]): Promise<ProcessResult> {
    const result = await runProcess("git", args, this.repoRoot);
    if (result.error || result.exitCode !== 0) throw gitFailure(args, result);
    return result;
  }

  async create(candidateId: string): Promise<CandidateWorktree> {
    this.assertDeepStandalone();
    const worktree = this.descriptor(candidateId);
    this.assertManagedPath(worktree.path);
    await mkdir(this.worktreeRoot, { recursive: true });
    await this.git([
      "worktree",
      "add",
      "-b",
      worktree.branch,
      worktree.path,
      "HEAD",
    ]);
    return worktree;
  }

  async run(
    candidate: CandidateWorktree | string,
    command: string,
    args: readonly string[] = [],
  ): Promise<WorktreeExecution> {
    this.assertDeepStandalone();
    const worktree = this.resolveWorktree(candidate);
    this.assertManagedPath(worktree.path);
    if (!existsSync(worktree.path)) {
      throw new Error(`Worktree does not exist: ${worktree.path}`);
    }

    const startedAt = Date.now();
    const result = await runProcess(command, args, worktree.path);
    const durationMs = Math.max(0, Date.now() - startedAt);
    const evidenceId = `EVD-${worktree.candidateId}-${Date.now()}-${++evidenceSequence}`;
    const evidence = NodeSchema.parse({
      id: evidenceId,
      type: "EVD",
      provenance_type: "MEASURED",
      statement: `${command} for ${worktree.candidateId} exited with ${result.exitCode ?? "signal"}`,
      status: result.exitCode === 0 ? "PASSED" : "FAILED",
      candidate_id: worktree.candidateId,
      branch: worktree.branch,
      worktree_path: worktree.path,
      command,
      args: [...args],
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exitCode,
      signal: result.signal,
      duration_ms: durationMs,
    });
    const edge = EdgeSchema.parse({
      source: evidence.id,
      target: worktree.candidateId,
      type: "tests",
    });

    return {
      candidateId: worktree.candidateId,
      worktree,
      command,
      args: [...args],
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      signal: result.signal,
      durationMs,
      evidence,
      node: evidence,
      edge,
    };
  }

  async cleanup(
    candidate: CandidateWorktree | string,
    options: WorktreeCleanupOptions = {},
  ): Promise<void> {
    this.assertDeepStandalone();
    const worktree = this.resolveWorktree(candidate);
    this.assertManagedPath(worktree.path);
    const removeArgs = ["worktree", "remove"];
    if (options.force) removeArgs.push("--force");
    removeArgs.push(worktree.path);
    await this.git(removeArgs);

    if (options.deleteBranch || options.removeBranch) {
      await this.git(["branch", "-d", worktree.branch]);
    }
  }
}

export const createWorktreeManager = (
  options: WorktreeManagerOptions,
): WorktreeManager => new WorktreeManager(options);
