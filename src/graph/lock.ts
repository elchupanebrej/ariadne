/**
 * Root directory locking protocol for Ariadne.
 * Coordinates concurrent processes via atomic directory creation,
 * PID-absent fast-path crash recovery, and fail-closed contention timeouts.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AriadneError } from "../core/errors.js";
import { assertContainedPath } from "../core/containment.js";

/** Default stale lock timeout in milliseconds (60 seconds). */
export const LOCK_STALE_MS = 60000;

/** Default initial backoff in milliseconds. */
export const DEFAULT_BACKOFF_INITIAL_MS = 25;

/** Default maximum backoff in milliseconds. */
export const DEFAULT_BACKOFF_MAX_MS = 100;

/**
 * Payload written to `.lock/owner.json` upon acquiring root lock.
 */
export interface LockOwnerPayload {
  schemaVersion: 1;
  pid: number;
  ownerToken: string;
  acquiredAt: string;
}

/**
 * Handle returned to caller upon successful lock acquisition.
 */
export interface LockHandle {
  readonly lockPath: string;
  readonly ownerToken: string;
  readonly pid: number;
  readonly acquiredAt: string;
  release(): Promise<void>;
}

/**
 * Options for configuring lock acquisition.
 */
export interface LockOptions {
  /** Maximum duration to wait before timing out (default: LOCK_STALE_MS = 60000). */
  timeoutMs?: number;
  /** Initial polling / backoff interval in milliseconds (default: 25ms). */
  pollIntervalMs?: number;
  /** Explicit lock path within storageRoot (default: `.lock` under storageRoot). */
  lockPath?: string;
}

/**
 * Possible status of a process probe via process.kill(pid, 0).
 */
export type ProcessProbeStatus = "alive" | "absent" | "ambiguous" | "unknown";

/**
 * Inspection result of a candidate lock directory.
 */
export interface LockInspection {
  status: ProcessProbeStatus;
  pid?: number;
  payload?: LockOwnerPayload;
}

function isValidPid(pid: unknown): pid is number {
  return typeof pid === "number" && Number.isInteger(pid) && pid > 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Probes the operating system process table for the specified PID using process.kill(pid, 0).
 *
 * @param pid - Positive integer PID to probe.
 * @returns "alive" if process exists, "absent" if ESRCH, "ambiguous" if EPERM, or "unknown".
 */
export function probeProcess(pid: number): ProcessProbeStatus {
  if (!isValidPid(pid)) {
    return "unknown";
  }
  try {
    process.kill(pid, 0);
    return "alive";
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: string }).code;
      if (code === "ESRCH") {
        return "absent";
      }
      if (code === "EPERM") {
        return "ambiguous";
      }
    }
    return "unknown";
  }
}

/**
 * Reads and validates `.lock/owner.json` payload if present.
 * Returns null if missing, unreadable, or not schemaVersion: 1.
 */
export async function readOwnerPayload(lockPath: string): Promise<LockOwnerPayload | null> {
  const ownerFile = path.join(lockPath, "owner.json");
  try {
    const raw = await fs.promises.readFile(ownerFile, "utf8");
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.schemaVersion === 1 &&
      typeof parsed.pid === "number" &&
      Number.isInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.ownerToken === "string" &&
      typeof parsed.acquiredAt === "string"
    ) {
      return parsed as LockOwnerPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Inspects a lock directory to determine owner status and process liveness.
 */
export async function inspectLock(lockPath: string): Promise<LockInspection> {
  const payload = await readOwnerPayload(lockPath);
  if (!payload) {
    return { status: "unknown" };
  }
  const status = probeProcess(payload.pid);
  return {
    status,
    pid: payload.pid,
    payload,
  };
}

/**
 * Safely reaps an abandoned lock directory left behind by a dead process.
 */
export async function reapAbandonedLock(lockPath: string): Promise<void> {
  const ownerFile = path.join(lockPath, "owner.json");
  try {
    await fs.promises.unlink(ownerFile).catch(() => {});
    await fs.promises.rmdir(lockPath).catch(async () => {
      await fs.promises.rm(lockPath, { recursive: true, force: true }).catch(() => {});
    });
  } catch {
    // Ignore concurrent removal
  }
}

/**
 * Releases a lock by verifying matching ownerToken, removing owner.json, and removing .lock.
 * Fails closed and does not delete if the token does not match.
 */
export async function releaseLock(lockPath: string, expectedToken: string): Promise<void> {
  const ownerFile = path.join(lockPath, "owner.json");
  let ownerData: LockOwnerPayload | null = null;
  try {
    const raw = await fs.promises.readFile(ownerFile, "utf8");
    ownerData = JSON.parse(raw);
  } catch {
    // Owner payload missing or unreadable; fail closed, do not delete
    return;
  }

  if (
    !ownerData ||
    typeof ownerData !== "object" ||
    ownerData.ownerToken !== expectedToken
  ) {
    // Token does not match (stolen or manipulated); fail closed, do not delete
    return;
  }

  try {
    await fs.promises.unlink(ownerFile).catch(() => {});
    await fs.promises.rmdir(lockPath).catch(() => {});
  } catch {
    // Ignore error if already cleaned up
  }
}

/**
 * Acquires root lock at `.lock` beneath canonical storageRoot with mutual exclusion,
 * PID-absent fast-path recovery, and fail-closed timeout semantics.
 */
export async function acquireRootLock(
  storageRoot: string,
  options?: LockOptions,
): Promise<LockHandle> {
  const timeoutMs =
    options?.timeoutMs !== undefined ? Math.max(0, options.timeoutMs) : LOCK_STALE_MS;
  const targetLockPath = options?.lockPath ?? path.join(storageRoot, ".lock");
  const canonicalLockPath = assertContainedPath(storageRoot, targetLockPath);

  // Ensure parent directory exists before attempting atomic mkdir
  await fs.promises.mkdir(path.dirname(canonicalLockPath), { recursive: true });

  const startTime = Date.now();
  const deadline = startTime + timeoutMs;
  let currentBackoff = options?.pollIntervalMs ?? DEFAULT_BACKOFF_INITIAL_MS;
  const maxBackoff = options?.pollIntervalMs ?? DEFAULT_BACKOFF_MAX_MS;

  while (true) {
    try {
      // Atomic directory creation with O_EXCL semantics (no recursive: true)
      await fs.promises.mkdir(canonicalLockPath);

      // Successfully acquired directory; write owner.json payload
      const ownerToken = randomUUID();
      const acquiredAt = new Date().toISOString();
      const payload: LockOwnerPayload = {
        schemaVersion: 1,
        pid: process.pid,
        ownerToken,
        acquiredAt,
      };

      const ownerPath = path.join(canonicalLockPath, "owner.json");
      try {
        await fs.promises.writeFile(
          ownerPath,
          JSON.stringify(payload, null, 2) + "\n",
          "utf8",
        );
      } catch (err) {
        // Cleanup created lock directory if payload write fails
        await fs.promises.rm(canonicalLockPath, { recursive: true, force: true }).catch(() => {});
        throw err;
      }

      let released = false;
      const handle: LockHandle = {
        lockPath: canonicalLockPath,
        ownerToken,
        pid: process.pid,
        acquiredAt,
        async release() {
          if (released) {
            return;
          }
          released = true;
          await releaseLock(canonicalLockPath, ownerToken);
        },
      };

      return handle;
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) {
        const code = (err as { code: string }).code;

        if (code === "ENOENT") {
          // Parent directory removed concurrently; re-ensure parent and retry
          await fs.promises.mkdir(path.dirname(canonicalLockPath), { recursive: true });
          continue;
        }

        if (code === "EEXIST") {
          // Contention! Check process status and owner.json
          const probe = await inspectLock(canonicalLockPath);

          if (probe.status === "absent") {
            // Fast-path recovery! The previous owner crashed.
            // Safely reap abandoned lock immediately and retry acquisition immediately without waiting.
            await reapAbandonedLock(canonicalLockPath);
            continue;
          }

          // Process is alive, ambiguous (EPERM), or owner.json is missing/unreadable.
          const now = Date.now();
          if (now >= deadline) {
            // Timeout expired! Apply fail-closed rules.
            if (probe.status === "alive" || probe.status === "ambiguous") {
              const ownerPid = probe.pid ?? 0;
              throw new AriadneError({
                code: "LOCK_OWNERSHIP_UNCERTAIN",
                message: `Lock held by external process (PID ${ownerPid}) could not be resolved within ${timeoutMs}ms.`,
                repair: "Check for running ariadne processes or inspect .ariadne/.lock/owner.json.",
                detail: {
                  lockPath: canonicalLockPath,
                  timeoutMs,
                  ownerPid,
                },
              });
            }

            // Uncontended lock timeout when no owner can be verified or lock is otherwise stuck
            throw new AriadneError({
              code: "LOCK_CONTENTION",
              message: `Failed to acquire root lock within ${timeoutMs}ms timeout.`,
              repair: "Check for running ariadne processes or inspect .ariadne/.lock/owner.json.",
              detail: {
                lockPath: canonicalLockPath,
                timeoutMs,
              },
            });
          }

          // Wait with retry backoff
          const remaining = deadline - now;
          const sleepMs = Math.min(currentBackoff, Math.max(1, remaining));
          await sleep(sleepMs);
          currentBackoff = Math.min(maxBackoff, Math.round(currentBackoff * 1.5));
          continue;
        }
      }

      // Any other filesystem error
      throw err;
    }
  }
}

/**
 * Higher-order helper that acquires the root lock, executes a callback,
 * and guarantees lock release in a finally block.
 */
export async function withRootLock<T>(
  storageRoot: string,
  callback: (lock: LockHandle) => Promise<T>,
  options?: LockOptions,
): Promise<T> {
  const lock = await acquireRootLock(storageRoot, options);
  try {
    return await callback(lock);
  } finally {
    await lock.release();
  }
}
