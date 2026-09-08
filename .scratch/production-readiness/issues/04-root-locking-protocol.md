# 04 — Process Mutual Exclusion and Root Locking Protocol

**What to build:**
A robust process-coordination engine using a single root lock at `.ariadne/.lock`. Acquired atomically via directory creation (`fs.mkdir`), the lock contains an `owner.json` payload tracking the holding process PID, unique owner token, and acquisition timestamp. Implements PID-absent fast-path recovery by checking the OS process table to safely reclaim locks abandoned by crashed processes immediately. Enforces a 60-second stale timeout, prohibits lock stealing when an external process is alive or ambiguous, requires matching owner tokens for release, and fails closed with actionable diagnostics on contention.

**Blocked by:**
- 01 — Unified Diagnostic Vocabulary and Error Model
- 02 — Storage Root Containment and Path Security

**Status:** resolved

- [x] Atomic lock acquisition is implemented using `fs.mkdir` (`O_EXCL` semantics) at `.ariadne/.lock`.
- [x] Lock payload `.ariadne/.lock/owner.json` is written containing `schemaVersion: 1`, `pid`, `ownerToken` (UUID), and ISO `acquiredAt` timestamp.
- [x] PID-absent fast-path recovery detects crashed owner processes (`ESRCH` via `process.kill(pid, 0)`), safely reaps abandoned locks, and reclaims ownership immediately without waiting for timeout.
- [x] Lock contention retries with backoff up to `LOCK_STALE_MS = 60000` (60 seconds).
- [x] Lock stealing by age alone is prohibited: if timeout expires while the owning process remains alive or ambiguous (`EPERM`), operation aborts immediately with `AriadneError(LOCK_OWNERSHIP_UNCERTAIN)`.
- [x] Uncontended lock timeout when no owner is verifiable aborts with `AriadneError(LOCK_CONTENTION)`.
- [x] Lock release protocol verifies matching `ownerToken` before removing `owner.json` and rmdir of `.lock`.
- [x] Concurrent multi-process integration tests verify mutual exclusion, fast-path recovery on killed processes, and failure on live contending processes.

## Implementation Details

### Module: `src/graph/lock.ts`
- **Constants**:
  - `LOCK_STALE_MS = 60000` (default 60s timeout budget).
  - `DEFAULT_BACKOFF_INITIAL_MS = 25` (initial retry backoff).
  - `DEFAULT_BACKOFF_MAX_MS = 100` (capped maximum retry backoff).
- **Types & Interfaces**:
  - `LockOwnerPayload`: Schema version 1 metadata containing `{ schemaVersion: 1, pid, ownerToken, acquiredAt }`.
  - `LockHandle`: Returned lock handle with `{ lockPath, ownerToken, pid, acquiredAt, release(): Promise<void> }`.
  - `LockOptions`: Options bag accepting `{ timeoutMs?, pollIntervalMs?, lockPath? }`.
  - `ProcessProbeStatus`: `"alive" | "absent" | "ambiguous" | "unknown"`.
  - `LockInspection`: `{ status, pid?, payload? }`.
- **Path Containment & Atomic Creation**:
  - Validates lock path with `assertContainedPath(storageRoot, lockPath)` from `src/core/containment.ts`, preventing directory traversal and symlink escapes with `AriadneError(PATH_ESCAPE)`.
  - Pre-creates parent directory `path.dirname(canonicalLockPath)` recursively.
  - Creates the `.lock` directory atomically via `fs.promises.mkdir(canonicalLockPath)` without `recursive: true` to enforce native `O_EXCL` mutual exclusion.
- **Payload Durability**:
  - On acquisition, writes `.lock/owner.json` with current PID, newly generated UUID v4 `ownerToken`, and ISO timestamp `acquiredAt`. Cleans up `.lock` if write fails.
- **PID-Absent Fast-Path Recovery**:
  - On `EEXIST` contention, reads `owner.json` and probes OS process status via `process.kill(pid, 0)`.
  - If `ESRCH` is returned, the owning process has crashed. Safely reaps the abandoned lock directory and re-attempts acquisition immediately without waiting.
- **Contention & Fail-Closed Timeout**:
  - If process is alive (`process.kill` succeeded), ambiguous (`EPERM`), or unreadable, retries with exponential backoff (25ms up to 100ms) until `timeoutMs`.
  - Lock age alone never authorizes stealing.
  - If timeout expires with a live or ambiguous process PID, aborts with `AriadneError(LOCK_OWNERSHIP_UNCERTAIN)` including `{ lockPath, timeoutMs, ownerPid }`.
  - If timeout expires with an unverified or stuck lock (missing/corrupt `owner.json`), aborts with `AriadneError(LOCK_CONTENTION)` including `{ lockPath, timeoutMs }`.
- **Release Protocol**:
  - Verifies `owner.json` exists and its `ownerToken` matches the handle's `ownerToken`.
  - Removes `owner.json` and directory `.lock`.
  - If token does not match or cannot be read, fails closed and refuses to delete.
  - Implements idempotent handle release.
- **Convenience Helper**:
  - `withRootLock<T>(storageRoot, callback, options)`: Acquires the root lock, runs `callback`, and guarantees release in a `finally` block.

### Test Suite: `tests/graph/lock.test.ts`
17 comprehensive unit and integration tests passing in isolated temporary directories:
1. `LOCK_STALE_MS` export equality (60000ms).
2. Basic acquisition and clean release verifying disk artifacts, payload structure, and release idempotency.
3. Automatic parent directory creation for uncreated storage roots.
4. `withRootLock` helper execution and guaranteed cleanup on success and callback rejection.
5. PID-absent fast-path recovery verifying instant reclamation of abandoned locks from dead processes.
6. Live contending child process timeout producing `AriadneError(LOCK_OWNERSHIP_UNCERTAIN)` with `ownerPid`, followed by immediate acquisition once child process is terminated.
7. Uncontended timeout with missing or corrupt `owner.json` producing `AriadneError(LOCK_CONTENTION)`.
8. Concurrency mutual exclusion test verifying multiple concurrent operations execute strictly serialized (peak concurrency = 1).
9. Owner token protection verifying mismatched tokens refuse to delete the lock.
10. Containment enforcement verifying `AriadneError(PATH_ESCAPE)` on path traversal or foreign targets.
11. Unit test coverage for `probeProcess`, `inspectLock`, and `reapAbandonedLock`.
