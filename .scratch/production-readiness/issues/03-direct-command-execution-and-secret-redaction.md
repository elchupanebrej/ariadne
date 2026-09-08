# 03 — Direct Command Execution and Secret Redaction

**What to build:**
A secure execution module for invoking external tools (such as Git, formatters, and verification commands). Spawns host processes directly without shell interpolation to prevent shell injection by design. Enforces resource constraints by bounding combined standard output and standard error capture to 1 MB with an explicit truncation warning banner, enforces timeouts with staged process termination (SIGTERM followed by SIGKILL), and sanitizes diagnostic details using regular expression scrubbing to prevent inadvertent leakage of secrets and tokens.

**Blocked by:** 01 — Unified Diagnostic Vocabulary and Error Model

**Status:** resolved

- [x] External commands are executed directly via `child_process.spawn()` with `shell: false`, accepting arguments as an explicit string array.
- [x] Combined `stdout` and `stderr` output capture is capped at 1 MB; output exceeding this limit is truncated and flagged with an explicit warning banner before persistence or reporting.
- [x] Configurable execution timeouts terminate stalled processes by issuing `SIGTERM` followed by `SIGKILL` on failure to terminate within a grace period, failing closed with `AriadneError(TIMEOUT)`.
- [x] Secret sanitization utility scrubs common credentials, bearer tokens, SSH private keys, and API tokens from command output before inclusion in diagnostic detail payloads.
- [x] Command exit failures cleanly map to `AriadneError(COMMAND_FAILED)` or exit status class 1 where continuation is permitted.
- [x] Unit tests verify shell bypass, 1 MB truncation bounding, timeout killing, and secret scrubbing against sample credential patterns.

## Implementation Details
- **Module `src/core/exec.ts`**:
  - `executeCommand(options: ExecuteCommandOptions): Promise<CommandResult>`:
    - Direct invocation via `child_process.spawn()` with `shell: false`, taking an explicit `args: readonly string[]` array.
    - Capped capture across `stdout` and `stderr` strictly limited to 1 MB (`MAX_OUTPUT_BYTES = 1024 * 1024` or 1,048,576 bytes). When exceeded, stream buffering ceases, `truncated: true` is set, and `TRUNCATION_WARNING_BANNER = "\n[WARNING: Command output exceeded 1 MB limit and was truncated]"` is appended.
    - Configurable timeouts (`timeoutMs`, default 30,000 ms) with staged two-phase termination (`SIGTERM` followed by `SIGKILL` after `killGraceMs`, default 500 ms), failing closed with `AriadneError(TIMEOUT)` with repair guidance.
    - Nonzero exit codes throw `AriadneError(COMMAND_FAILED)` when `rejectOnError: true` (default) with redacted stdout/stderr diagnostics in `detail`, or return `{ exitCode, stdout, stderr, combinedOutput, truncated }` when `rejectOnError: false`.
    - Input validation fail-closed using `AriadneError(INVALID_INPUT)` for malformed command, args, timeoutMs, or maxOutputBytes.
  - `redactSecrets(text: string): string`:
    - Regex-based credential scrubber targeting Bearer tokens, JWTs, SSH private keys (RSA, OpenSSH, EC, generic), GitHub tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`), AWS Access Key IDs and secret keys, and generic query string or config key-value assignments (`password=`, `secret=`, `api_key=`, `token=`).
    - Preserves non-sensitive strings, git commit SHAs, and avoids double-redacting already sanitized tokens.
- **Unit Test Suite `tests/core/exec.test.ts`**:
  - 27 unit tests verifying direct argv spawn without shell, literal metacharacter handling, stdout/stderr/stdin capture, 1 MB output truncation and banner appending, timeout enforcement and SIGTERM->SIGKILL escalation, failure mapping to `AriadneError(COMMAND_FAILED)`, and regex scrubbing across all token categories.
