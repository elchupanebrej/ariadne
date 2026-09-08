import { spawn } from "node:child_process";
import { AriadneError } from "./errors.js";

/**
 * Default command execution timeout: 30,000 milliseconds (30 seconds).
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Default grace period between SIGTERM and SIGKILL upon timeout: 500 milliseconds.
 */
export const DEFAULT_KILL_GRACE_MS = 500;

/**
 * Maximum combined output bytes for stdout and stderr: 1 MB (1,048,576 bytes).
 */
export const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * Warning banner appended when command output capture is truncated at 1 MB.
 */
export const TRUNCATION_WARNING_BANNER =
  "\n[WARNING: Command output exceeded 1 MB limit and was truncated]";

/**
 * Regular expressions for credential and token scrubbing.
 */
const SSH_PRIVATE_KEY_PATTERN =
  /-----BEGIN [A-Z0-9 _-]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 _-]*PRIVATE KEY-----/g;

const AWS_ACCESS_KEY_ID_PATTERN = /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g;

const AWS_SECRET_KEY_ASSIGNMENT_PATTERN =
  /(?:^|(?<=[\s,;?&()'"[\]{}<>]|\b))(aws_secret_access_key|aws_secret_key|secret_access_key)\s*([:=])\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s"';&]+))/gi;

const GITHUB_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Za-z0-9_]{10,}|github_pat_[A-Za-z0-9_]+)\b/g;

const BEARER_TOKEN_PATTERN =
  /\b(Bearer)\s+(?:(?!\[REDACTED)[A-Za-z0-9._~+/-]+=*)/gi;

const JWT_PATTERN =
  /\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/g;

const GENERIC_SECRET_PATTERN =
  /(?:^|(?<=[\s,;?&()'"[\]{}<>]|\b))([a-zA-Z0-9_.-]*(?:password|passwd|pwd|secret|api[_-]?key|token)[a-zA-Z0-9_.-]*)\s*([:=])\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s"';&]+))/gi;

/**
 * Scrubs sensitive credentials, tokens, and keys from strings before
 * diagnostic detail inclusion or persistence.
 *
 * Sanitizes:
 * - Bearer tokens -> Bearer [REDACTED]
 * - JWT tokens -> [REDACTED JWT]
 * - SSH private keys -> [REDACTED PRIVATE KEY]
 * - GitHub Personal Access Tokens and fine-grained tokens -> [REDACTED GITHUB TOKEN]
 * - AWS Access Key IDs and Secret Keys -> [REDACTED AWS KEY]
 * - Generic password / secret / api_key / token assignments -> key=[REDACTED]
 *
 * @param text - Raw text potentially containing secrets.
 * @returns Scrubbed text with credentials redacted.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== "string") {
    return text;
  }

  let result = text;

  // 1. SSH Private Keys
  result = result.replace(SSH_PRIVATE_KEY_PATTERN, "[REDACTED PRIVATE KEY]");

  // 2. AWS Keys: Secret Keys in assignments and Access Key IDs
  result = result.replace(
    AWS_SECRET_KEY_ASSIGNMENT_PATTERN,
    (_match, key, sep, val1, val2, val3) => {
      const val = val1 ?? val2 ?? val3 ?? "";
      if (val.startsWith("[REDACTED")) {
        return _match;
      }
      return `${key}${sep === ":" ? ": " : "="}[REDACTED AWS KEY]`;
    },
  );
  result = result.replace(AWS_ACCESS_KEY_ID_PATTERN, "[REDACTED AWS KEY]");

  // 3. GitHub Personal Access Tokens and fine-grained tokens
  result = result.replace(GITHUB_TOKEN_PATTERN, "[REDACTED GITHUB TOKEN]");

  // 4. Bearer Tokens
  result = result.replace(BEARER_TOKEN_PATTERN, "$1 [REDACTED]");

  // 5. JWT Tokens
  result = result.replace(JWT_PATTERN, "[REDACTED JWT]");

  // 6. Generic password / secret / api_key / token assignments
  result = result.replace(
    GENERIC_SECRET_PATTERN,
    (_match, key, sep, val1, val2, val3) => {
      const val = val1 ?? val2 ?? val3 ?? "";
      if (val.startsWith("[REDACTED")) {
        return _match;
      }
      const separator = sep === ":" ? ": " : "=";
      return `${key}${separator}[REDACTED]`;
    },
  );

  return result;
}

/**
 * Options for direct command execution.
 */
export interface ExecuteCommandOptions {
  /**
   * Host executable or command name to spawn.
   */
  command: string;

  /**
   * Explicit array of string arguments passed directly to spawn.
   * Shell interpolation and expansion are disabled by design.
   */
  args?: readonly string[];

  /**
   * Current working directory for process execution.
   */
  cwd?: string;

  /**
   * Environment variables for the child process.
   * Defaults to process.env.
   */
  env?: NodeJS.ProcessEnv;

  /**
   * Execution timeout in milliseconds.
   * Defaults to 30,000 ms (30 seconds).
   */
  timeoutMs?: number;

  /**
   * Grace period in milliseconds between SIGTERM and SIGKILL upon timeout.
   * Defaults to 500 ms.
   */
  killGraceMs?: number;

  /**
   * Maximum combined bytes captured across stdout and stderr.
   * Defaults to 1 MB (1,048,576 bytes).
   */
  maxOutputBytes?: number;

  /**
   * Whether to throw an AriadneError(COMMAND_FAILED) when the command
   * exits with a non-zero exit code.
   * Defaults to true.
   */
  rejectOnError?: boolean;

  /**
   * Optional standard input to write to the child process stdin.
   */
  input?: string | Buffer;
}

/**
 * Result of executing an external host command.
 */
export interface CommandResult {
  /**
   * Process exit code. 0 indicates success.
   */
  exitCode: number;

  /**
   * Captured standard output (bounded by maxOutputBytes).
   */
  stdout: string;

  /**
   * Captured standard error (bounded by maxOutputBytes).
   */
  stderr: string;

  /**
   * Chronologically interleaved or combined output of stdout and stderr.
   */
  combinedOutput: string;

  /**
   * Whether combined output exceeded maxOutputBytes and was truncated.
   */
  truncated: boolean;
}

/**
 * Executes an external host process directly without shell interpolation.
 *
 * Enforces:
 * - Direct argv invocation via `child_process.spawn()` with `shell: false`.
 * - Combined stdout and stderr capture strictly bounded to 1 MB (1,048,576 bytes).
 * - Truncation warning banner appended when 1 MB bound is exceeded.
 * - Configurable execution timeouts with staged termination (SIGTERM followed by SIGKILL).
 * - Fail-closed error mapping via `AriadneError(TIMEOUT)` and `AriadneError(COMMAND_FAILED)`.
 *
 * @param options - Execution configuration options.
 * @returns Promise resolving to `CommandResult`.
 */
export function executeCommand(
  options: ExecuteCommandOptions,
): Promise<CommandResult> {
  const {
    command,
    args = [],
    cwd,
    env = process.env,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    killGraceMs = DEFAULT_KILL_GRACE_MS,
    maxOutputBytes = MAX_OUTPUT_BYTES,
    rejectOnError = true,
    input,
  } = options;

  if (typeof command !== "string" || command.trim() === "") {
    return Promise.reject(
      new AriadneError({
        code: "INVALID_INPUT",
        message: "Command must be a non-empty string",
        repair: "Provide a valid executable command name or path.",
        detail: { command },
      }),
    );
  }

  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
    return Promise.reject(
      new AriadneError({
        code: "INVALID_INPUT",
        message: "Command arguments must be an array of strings",
        repair: "Provide command arguments as an array of string values.",
        detail: { command, args },
      }),
    );
  }

  if (
    typeof timeoutMs !== "number" ||
    timeoutMs <= 0 ||
    Number.isNaN(timeoutMs)
  ) {
    return Promise.reject(
      new AriadneError({
        code: "INVALID_INPUT",
        message: "timeoutMs must be a positive number",
        repair: "Provide a positive timeout duration in milliseconds.",
        detail: { timeoutMs },
      }),
    );
  }

  if (
    typeof maxOutputBytes !== "number" ||
    maxOutputBytes <= 0 ||
    Number.isNaN(maxOutputBytes)
  ) {
    return Promise.reject(
      new AriadneError({
        code: "INVALID_INPUT",
        message: "maxOutputBytes must be a positive number",
        repair: "Provide a positive maximum output byte limit.",
        detail: { maxOutputBytes },
      }),
    );
  }

  return new Promise<CommandResult>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, [...args], {
        shell: false,
        cwd,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      reject(
        new AriadneError({
          code: "COMMAND_FAILED",
          message: `Command '${command}' failed to spawn: ${message}`,
          detail: { command, args: [...args], error: message },
        }),
      );
      return;
    }

    let settled = false;
    let timedOut = false;
    let timeoutTimer: NodeJS.Timeout | null = null;
    let killGraceTimer: NodeJS.Timeout | null = null;
    let fallbackKillTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (killGraceTimer) clearTimeout(killGraceTimer);
      if (fallbackKillTimer) clearTimeout(fallbackKillTimer);
    };

    let combinedBytes = 0;
    let truncated = false;
    let stdoutTruncated = false;
    let stderrTruncated = false;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const combinedChunks: Buffer[] = [];

    const handleChunk = (rawChunk: Buffer | string, isStdout: boolean) => {
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(rawChunk);

      if (truncated) {
        if (isStdout) stdoutTruncated = true;
        else stderrTruncated = true;
        return;
      }

      if (combinedBytes + chunk.length <= maxOutputBytes) {
        combinedBytes += chunk.length;
        if (isStdout) {
          stdoutChunks.push(chunk);
        } else {
          stderrChunks.push(chunk);
        }
        combinedChunks.push(chunk);
      } else {
        truncated = true;
        if (isStdout) stdoutTruncated = true;
        else stderrTruncated = true;

        const allowed = Math.max(0, maxOutputBytes - combinedBytes);
        if (allowed > 0) {
          const slice = chunk.subarray(0, allowed);
          combinedBytes += allowed;
          if (isStdout) {
            stdoutChunks.push(slice);
          } else {
            stderrChunks.push(slice);
          }
          combinedChunks.push(slice);
        }
      }
    };

    if (child.stdout) {
      child.stdout.on("data", (chunk) => handleChunk(chunk, true));
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => handleChunk(chunk, false));
    }

    if (child.stdin) {
      child.stdin.on("error", () => {
        // Suppress EPIPE on child stdin when child process exits early
      });
      if (input !== undefined) {
        child.stdin.write(input);
      }
      child.stdin.end();
    }

    timeoutTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {
        // Child process may have already exited
      }

      killGraceTimer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // Child process may have already exited
        }
      }, killGraceMs);
      killGraceTimer.unref?.();

      fallbackKillTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(
            new AriadneError({
              code: "TIMEOUT",
              message: `Command '${command}' timed out after ${timeoutMs}ms`,
              repair:
                "Check command performance or increase the timeout limit.",
              detail: { command, args: [...args], timeoutMs },
            }),
          );
        }
      }, killGraceMs * 2);
      fallbackKillTimer.unref?.();
    }, timeoutMs);
    timeoutTimer.unref?.();

    child.on("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      if (settled) return;
      settled = true;
      reject(
        new AriadneError({
          code: "COMMAND_FAILED",
          message: `Command '${command}' failed to execute: ${err.message}`,
          detail: { command, args: [...args], error: err.message },
        }),
      );
    });

    child.on("close", (exitCode, signal) => {
      cleanup();
      if (settled) return;
      settled = true;

      if (timedOut) {
        reject(
          new AriadneError({
            code: "TIMEOUT",
            message: `Command '${command}' timed out after ${timeoutMs}ms`,
            repair:
              "Check command performance or increase the timeout limit.",
            detail: { command, args: [...args], timeoutMs },
          }),
        );
        return;
      }

      let stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      let stderr = Buffer.concat(stderrChunks).toString("utf-8");
      let combinedOutput = Buffer.concat(combinedChunks).toString("utf-8");

      if (truncated) {
        combinedOutput += TRUNCATION_WARNING_BANNER;
        if (stdoutTruncated) {
          stdout += TRUNCATION_WARNING_BANNER;
        }
        if (stderrTruncated) {
          stderr += TRUNCATION_WARNING_BANNER;
        }
      }

      const code = exitCode ?? (signal ? 1 : 0);

      if (code !== 0 && rejectOnError) {
        reject(
          new AriadneError({
            code: "COMMAND_FAILED",
            message: `Command '${command}' failed with exit code ${code}`,
            detail: {
              command,
              args: [...args],
              exitCode: code,
              stdout: redactSecrets(stdout),
              stderr: redactSecrets(stderr),
            },
          }),
        );
        return;
      }

      resolve({
        exitCode: code,
        stdout,
        stderr,
        combinedOutput,
        truncated,
      });
    });
  });
}
