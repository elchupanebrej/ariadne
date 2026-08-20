import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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

type ExecutionReceipt = {
  format: "junit" | "tap" | "json" | "process";
  verdict: "SUPPORTED" | "FALSIFIED" | "INCONCLUSIVE";
  tests?: { total?: number; passed?: number; failed?: number; skipped?: number };
  duration_ms?: number;
  metrics: Record<string, number>;
};

const numberAttribute = (attributes: string, name: string): number | undefined => {
  const value = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "iu").exec(attributes)?.[1];
  const parsed = value === undefined ? NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const metricFallback = (text: string): Record<string, number> => {
  const metrics: Record<string, number> = {};
  for (const match of text.matchAll(
    /\b(MSI|mutation[_ ]?score(?:[_ ]?indicator)?|p95|p99|throughput|latency)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)\s*(%|ms)?/giu,
  )) {
    const key = match[1].toLowerCase().replaceAll(" ", "_");
    metrics[key === "msi" ? "mutation_score_indicator" : key] = Number(match[2]);
  }
  const killed = /\b([0-9]+)\s*(?:mutations?\s+)?killed\s*(?:of|\/)\s*([0-9]+)/iu.exec(text);
  if (killed) {
    metrics.mutation_score_indicator = (Number(killed[1]) / Number(killed[2])) * 100;
  }
  return metrics;
};

const parseJUnit = (text: string): ExecutionReceipt | undefined => {
  if (!/<testsuite\b|<testsuites\b/iu.test(text)) return undefined;
  const suites = [...text.matchAll(/<testsuite\b([^>]*)>/giu)];
  const testcases = (text.match(/<testcase\b/giu) ?? []).length;
  const failures =
    (text.match(/<(?:failure|error)\b/giu) ?? []).length ||
    suites.reduce(
      (sum, match) =>
        sum +
        (numberAttribute(match[1], "failures") ?? 0) +
        (numberAttribute(match[1], "errors") ?? 0),
      0,
    );
  const skipped =
    (text.match(/<skipped\b/giu) ?? []).length ||
    suites.reduce((sum, match) => sum + (numberAttribute(match[1], "skipped") ?? 0), 0);
  const total = suites.reduce((sum, match) => sum + (numberAttribute(match[1], "tests") ?? 0), 0) || testcases;
  const duration = suites.reduce((sum, match) => sum + (numberAttribute(match[1], "time") ?? 0), 0);
  return {
    format: "junit",
    verdict: failures > 0 ? "FALSIFIED" : "SUPPORTED",
    tests: {
      total,
      passed: Math.max(0, total - failures - skipped),
      failed: failures,
      skipped,
    },
    ...(duration > 0 ? { duration_ms: duration * 1000 } : {}),
    metrics: metricFallback(text),
  };
};

const parseTap = (text: string): ExecutionReceipt | undefined => {
  const results = [...text.matchAll(/^\s*(not\s+)?ok\b/gimu)];
  if (results.length === 0 && !/^\s*1\.\.[0-9]+/imu.test(text)) return undefined;
  const plan = Number(/^\s*1\.\.(\d+)/imu.exec(text)?.[1] ?? results.length);
  const failed = results.filter((match) => match[1]).length;
  return {
    format: "tap",
    verdict: failed > 0 || (plan > 0 && results.length < plan) ? "FALSIFIED" : "SUPPORTED",
    tests: {
      total: plan,
      passed: results.length - failed,
      failed,
    },
    metrics: metricFallback(text),
  };
};

const jsonVerdict = (value: unknown): "SUPPORTED" | "FALSIFIED" | undefined => {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    const verdicts = value.map(jsonVerdict).filter((entry): entry is "SUPPORTED" | "FALSIFIED" => entry !== undefined);
    return verdicts.includes("FALSIFIED") ? "FALSIFIED" : verdicts.includes("SUPPORTED") ? "SUPPORTED" : undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.failed === true || record.success === false || record.numFailedTests && Number(record.numFailedTests) > 0) return "FALSIFIED";
  if (record.passed === true || record.success === true || record.numPassedTests && Number(record.numPassedTests) > 0) return "SUPPORTED";
  const status = [
    record.status,
    record.outcome,
    record.verdict,
    record.result,
    record.event,
    record.action,
  ]
    .find((entry): entry is string => typeof entry === "string")
    ?.toLowerCase() ?? "";
  if (/fail|error|broken|not ok/iu.test(status)) return "FALSIFIED";
  if (/pass|success|ok/iu.test(status)) return "SUPPORTED";
  const nested = Object.values(record)
    .map(jsonVerdict)
    .filter((entry): entry is "SUPPORTED" | "FALSIFIED" => entry !== undefined);
  return nested.includes("FALSIFIED")
    ? "FALSIFIED"
    : nested.includes("SUPPORTED")
      ? "SUPPORTED"
      : undefined;
};

const parseJson = (text: string): ExecutionReceipt | undefined => {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    const records = trimmed.split(/\r?\n/u).filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown];
      } catch {
        return [];
      }
    });
    if (records.length === 0) return undefined;
    value = records;
  }
  const verdict = jsonVerdict(value);
  if (!verdict) return undefined;
  return {
    format: "json",
    verdict,
    metrics: metricFallback(text),
  };
};

const parseExecutionReceipt = (
  stdout: string,
  stderr: string,
  exitCode: number | null,
): ExecutionReceipt => {
  const text = `${stdout}\n${stderr}`;
  const parsed = parseJUnit(text) ?? parseTap(text) ?? parseJson(stdout);
  const metrics = { ...metricFallback(text), ...(parsed?.metrics ?? {}) };
  return parsed
    ? {
        ...parsed,
        verdict: exitCode === 0 ? parsed.verdict : "FALSIFIED",
        metrics,
      }
    : {
        format: "process",
        verdict: exitCode === 0 ? "SUPPORTED" : "FALSIFIED",
        metrics,
      };
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
    const receipt = parseExecutionReceipt(result.stdout, result.stderr, result.exitCode);
    const stdoutDigest = createHash("sha256")
      .update(`${result.stdout}\n${result.stderr}`)
      .digest("hex");
    const testCommand = [command, ...args].join(" ");
    const evidenceId = `EVD-${worktree.candidateId}-${Date.now()}-${++evidenceSequence}`;
    const evidence = NodeSchema.parse({
      id: evidenceId,
      type: "EVD",
      provenance_type: "MEASURED",
      statement: `${command} for ${worktree.candidateId} exited with ${result.exitCode ?? "signal"}`,
      status:
        receipt.verdict === "SUPPORTED" && result.exitCode === 0
          ? "PASSED"
          : receipt.verdict === "INCONCLUSIVE"
            ? "INCONCLUSIVE"
            : "FAILED",
      candidate_id: worktree.candidateId,
      branch: worktree.branch,
      worktree_path: worktree.path,
      command,
      args: [...args],
      test_command: testCommand,
      verdict: receipt.verdict,
      method: `${receipt.format}-receipt`,
      // A local receipt supports only the example-based execution rung; callers may raise it with stronger evidence.
      rung: 3,
      stdout_digest: stdoutDigest,
      reproducible_environment: `${process.platform}/${process.arch}; ${process.version}`,
      receipt: {
        format: receipt.format,
        verdict: receipt.verdict,
        ...(receipt.tests ? { tests: receipt.tests } : {}),
        ...(receipt.duration_ms !== undefined ? { duration_ms: receipt.duration_ms } : {}),
        metrics: receipt.metrics,
      },
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
