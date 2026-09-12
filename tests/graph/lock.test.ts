import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  LOCK_STALE_MS,
  acquireRootLock,
  withRootLock,
  probeProcess,
  readOwnerPayload,
  inspectLock,
  releaseLock,
  reapAbandonedLock,
} from "../../src/graph/lock.js";
import { AriadneError, isAriadneError } from "../../src/core/errors.js";

describe("Root Locking Protocol (src/graph/lock.ts)", () => {
  let tempDir: string;
  let storageRoot: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-lock-test-")));
    storageRoot = path.join(tempDir, ".ariadne");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error in test tempdir
    }
  });

  it("exports LOCK_STALE_MS equal to 60000ms", () => {
    expect(LOCK_STALE_MS).toBe(60000);
  });

  it("acquires lock and cleans up on release", async () => {
    const lock = await acquireRootLock(storageRoot);

    expect(lock.lockPath).toBe(path.join(storageRoot, ".lock"));
    expect(lock.pid).toBe(process.pid);
    expect(typeof lock.ownerToken).toBe("string");
    expect(lock.ownerToken.length).toBeGreaterThan(10);
    expect(typeof lock.acquiredAt).toBe("string");
    expect(Date.parse(lock.acquiredAt)).not.toBeNaN();

    // Verify .lock directory and owner.json payload on disk
    expect(fs.existsSync(lock.lockPath)).toBe(true);
    const ownerFile = path.join(lock.lockPath, "owner.json");
    expect(fs.existsSync(ownerFile)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(ownerFile, "utf8"));
    expect(payload).toEqual({
      schemaVersion: 1,
      pid: process.pid,
      ownerToken: lock.ownerToken,
      acquiredAt: lock.acquiredAt,
    });

    // Release the lock
    await lock.release();

    expect(fs.existsSync(ownerFile)).toBe(false);
    expect(fs.existsSync(lock.lockPath)).toBe(false);

    // Calling release again is safe and idempotent
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it("creates parent storageRoot directory automatically if not present", async () => {
    const nestedRoot = path.join(tempDir, "deep", "nested", ".ariadne");
    expect(fs.existsSync(nestedRoot)).toBe(false);

    const lock = await acquireRootLock(nestedRoot);
    expect(fs.existsSync(nestedRoot)).toBe(true);
    expect(fs.existsSync(lock.lockPath)).toBe(true);

    await lock.release();
    expect(fs.existsSync(lock.lockPath)).toBe(false);
    expect(fs.existsSync(nestedRoot)).toBe(true);
  });

  describe("withRootLock helper", () => {
    it("executes callback and releases lock on success", async () => {
      let executed = false;
      const result = await withRootLock(storageRoot, async (lock) => {
        executed = true;
        expect(fs.existsSync(path.join(lock.lockPath, "owner.json"))).toBe(true);
        return "success-result";
      });

      expect(executed).toBe(true);
      expect(result).toBe("success-result");
      expect(fs.existsSync(path.join(storageRoot, ".lock"))).toBe(false);
    });

    it("executes callback and releases lock when callback throws", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      let observedInside = false;

      await expect(
        withRootLock(storageRoot, async (lock) => {
          observedInside = fs.existsSync(lock.lockPath);
          throw new Error("simulated failure inside withRootLock");
        }),
      ).rejects.toThrow("simulated failure inside withRootLock");

      expect(observedInside).toBe(true);
      expect(fs.existsSync(lockPath)).toBe(false);
    });
  });

  describe("PID-absent fast-path recovery", () => {
    it("detects dead owner process, reaps abandoned lock immediately, and acquires without delay", async () => {
      // Spawn a short-lived process that terminates immediately to obtain a dead PID
      const child = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
      const deadPid = child.pid;
      expect(probeProcess(deadPid)).toBe("absent");

      // Manually plant an abandoned lock left behind by the dead process
      const lockPath = path.join(storageRoot, ".lock");
      fs.mkdirSync(lockPath, { recursive: true });
      fs.writeFileSync(
        path.join(lockPath, "owner.json"),
        JSON.stringify({
          schemaVersion: 1,
          pid: deadPid,
          ownerToken: "abandoned-uuid-token",
          acquiredAt: new Date(Date.now() - 5000).toISOString(),
        }),
        "utf8",
      );

      const startTime = Date.now();
      // Acquire with default or long timeout to prove fast path does not wait
      const lock = await acquireRootLock(storageRoot, { timeoutMs: 10000 });
      const elapsedMs = Date.now() - startTime;

      // Acquisition must be near-instant (well under 500ms, definitely not waiting for timeout)
      expect(elapsedMs).toBeLessThan(1000);
      expect(lock.pid).toBe(process.pid);
      expect(lock.ownerToken).not.toBe("abandoned-uuid-token");

      // The new owner payload should be recorded
      const ownerPayload = await readOwnerPayload(lock.lockPath);
      expect(ownerPayload?.pid).toBe(process.pid);
      expect(ownerPayload?.ownerToken).toBe(lock.ownerToken);

      await lock.release();
      expect(fs.existsSync(lockPath)).toBe(false);
    });
  });

  describe("Live contending process & uncertain ownership", () => {
    it("fails with LOCK_OWNERSHIP_UNCERTAIN on live process timeout, then succeeds after process dies", async () => {
      const lockPath = path.join(storageRoot, ".lock");

      // Spawn long-running background child process that creates the lock
      const child = spawn(
        process.execPath,
        [
          "-e",
          `
          const fs = require("node:fs");
          const path = require("node:path");
          const lockDir = process.argv[1];
          fs.mkdirSync(lockDir, { recursive: true });
          fs.writeFileSync(
            path.join(lockDir, "owner.json"),
            JSON.stringify({
              schemaVersion: 1,
              pid: process.pid,
              ownerToken: "child-process-token-123",
              acquiredAt: new Date().toISOString()
            })
          );
          console.log("READY");
          setInterval(() => {}, 1000);
          `,
          lockPath,
        ],
        { stdio: ["ignore", "pipe", "inherit"] },
      );

      // Wait until child signals READY
      await new Promise<void>((resolve, reject) => {
        child.stdout.on("data", (chunk: Buffer) => {
          if (chunk.toString().includes("READY")) {
            resolve();
          }
        });
        child.on("error", reject);
      });

      const childPid = child.pid!;
      expect(probeProcess(childPid)).toBe("alive");

      // Try acquiring with short timeout (150ms)
      let caughtError: unknown = null;
      try {
        await acquireRootLock(storageRoot, { timeoutMs: 150, pollIntervalMs: 25 });
      } catch (err) {
        caughtError = err;
      }

      expect(isAriadneError(caughtError)).toBe(true);
      const aerr = caughtError as AriadneError;
      expect(aerr.code).toBe("LOCK_OWNERSHIP_UNCERTAIN");
      expect(aerr.message).toContain(`Lock held by external process (PID ${childPid})`);
      expect(aerr.detail?.ownerPid).toBe(childPid);
      expect(aerr.detail?.timeoutMs).toBe(150);
      expect(aerr.detail?.lockPath).toBe(lockPath);
      expect(aerr.repair).toContain("Check for running ariadne processes");

      // Now kill the contending child process
      child.kill("SIGKILL");
      await new Promise((resolve) => child.on("exit", resolve));
      expect(probeProcess(childPid)).toBe("absent");

      // Fast-path recovery will now reap the dead child's lock and acquire successfully
      const lock = await acquireRootLock(storageRoot, { timeoutMs: 2000, pollIntervalMs: 25 });
      expect(lock.pid).toBe(process.pid);
      expect(lock.ownerToken).not.toBe("child-process-token-123");

      await lock.release();
      expect(fs.existsSync(lockPath)).toBe(false);
    });
  });

  describe("Uncontended or unresolvable lock contention", () => {
    it("fails with LOCK_CONTENTION when owner.json is missing and timeout expires", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      // Create empty lock directory without owner.json
      fs.mkdirSync(lockPath, { recursive: true });

      let caughtError: unknown = null;
      try {
        await acquireRootLock(storageRoot, { timeoutMs: 100, pollIntervalMs: 20 });
      } catch (err) {
        caughtError = err;
      }

      expect(isAriadneError(caughtError)).toBe(true);
      const aerr = caughtError as AriadneError;
      expect(aerr.code).toBe("LOCK_CONTENTION");
      expect(aerr.message).toContain("Failed to acquire root lock within 100ms timeout");
      expect(aerr.detail?.lockPath).toBe(lockPath);
      expect(aerr.detail?.timeoutMs).toBe(100);
      expect(aerr.detail?.ownerPid).toBeUndefined();
    });

    it("fails with LOCK_CONTENTION when owner.json contains invalid schema or PID", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      fs.mkdirSync(lockPath, { recursive: true });
      fs.writeFileSync(
        path.join(lockPath, "owner.json"),
        JSON.stringify({ schemaVersion: 1, pid: -999, ownerToken: "test" }),
        "utf8",
      );

      let caughtError: unknown = null;
      try {
        await acquireRootLock(storageRoot, { timeoutMs: 80, pollIntervalMs: 20 });
      } catch (err) {
        caughtError = err;
      }

      expect(isAriadneError(caughtError)).toBe(true);
      const aerr = caughtError as AriadneError;
      expect(aerr.code).toBe("LOCK_CONTENTION");
    });
  });

  describe("Mutual exclusion", () => {
    it("serializes concurrent asynchronous operations strictly one-at-a-time", async () => {
      let concurrentActive = 0;
      let peakConcurrency = 0;
      const finished: number[] = [];

      const runWorker = async (workerId: number, holdTimeMs: number) => {
        return withRootLock(
          storageRoot,
          async () => {
            concurrentActive++;
            peakConcurrency = Math.max(peakConcurrency, concurrentActive);

            await new Promise((resolve) => setTimeout(resolve, holdTimeMs));

            concurrentActive--;
            finished.push(workerId);
            return workerId;
          },
          { timeoutMs: 5000, pollIntervalMs: 15 },
        );
      };

      const results = await Promise.all([
        runWorker(1, 40),
        runWorker(2, 40),
        runWorker(3, 40),
      ]);

      expect(results).toEqual([1, 2, 3]);
      expect(finished).toHaveLength(3);
      expect(peakConcurrency).toBe(1);
      expect(concurrentActive).toBe(0);
      expect(fs.existsSync(path.join(storageRoot, ".lock"))).toBe(false);
    });
  });

  describe("Owner token protection on release", () => {
    it("refuses to delete lock if ownerToken does not match", async () => {
      const lock = await acquireRootLock(storageRoot);
      const ownerFile = path.join(lock.lockPath, "owner.json");
      expect(fs.existsSync(ownerFile)).toBe(true);

      // Tamper owner.json with a different ownerToken
      const tampered = {
        schemaVersion: 1,
        pid: process.pid,
        ownerToken: "different-tampered-uuid",
        acquiredAt: new Date().toISOString(),
      };
      fs.writeFileSync(ownerFile, JSON.stringify(tampered, null, 2), "utf8");

      // Attempt release with the handle's original token
      await lock.release();

      // Lock directory and owner.json must STILL exist (fail closed)
      expect(fs.existsSync(ownerFile)).toBe(true);
      expect(fs.existsSync(lock.lockPath)).toBe(true);

      // Verify direct releaseLock function also fails closed with mismatched token
      await releaseLock(lock.lockPath, "wrong-token");
      expect(fs.existsSync(lock.lockPath)).toBe(true);

      // Cleanup manually
      fs.rmSync(lock.lockPath, { recursive: true, force: true });
    });

    it("refuses to delete lock if owner.json is missing or unreadable", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      fs.mkdirSync(lockPath, { recursive: true });

      await releaseLock(lockPath, "any-token");
      expect(fs.existsSync(lockPath)).toBe(true);

      fs.rmSync(lockPath, { recursive: true, force: true });
    });
  });

  describe("Containment enforcement", () => {
    it("throws PATH_ESCAPE when lockPath resolves outside storage root", async () => {
      const outsidePath = path.join(storageRoot, "..", "escaped.lock");

      let caughtError: unknown = null;
      try {
        await acquireRootLock(storageRoot, { lockPath: outsidePath });
      } catch (err) {
        caughtError = err;
      }

      expect(isAriadneError(caughtError)).toBe(true);
      const aerr = caughtError as AriadneError;
      expect(aerr.code).toBe("PATH_ESCAPE");
      expect(aerr.message).toContain("resolves outside storage root");
    });

    it("throws PATH_ESCAPE when lockPath is absolute path pointing elsewhere", async () => {
      const foreignPath = path.join(os.tmpdir(), "completely-outside.lock");

      let caughtError: unknown = null;
      try {
        await acquireRootLock(storageRoot, { lockPath: foreignPath });
      } catch (err) {
        caughtError = err;
      }

      expect(isAriadneError(caughtError)).toBe(true);
      const aerr = caughtError as AriadneError;
      expect(aerr.code).toBe("PATH_ESCAPE");
    });
  });

  describe("Helper unit tests", () => {
    it("probeProcess returns appropriate statuses", () => {
      expect(probeProcess(process.pid)).toBe("alive");
      expect(probeProcess(-1)).toBe("unknown");
      expect(probeProcess(0)).toBe("unknown");
      expect(probeProcess(NaN)).toBe("unknown");
      expect(probeProcess(3.14)).toBe("unknown");
    });

    it("inspectLock handles non-existent or malformed lock directories", async () => {
      const nonExistent = path.join(storageRoot, "non-existent.lock");
      const emptyDir = path.join(storageRoot, "empty.lock");
      fs.mkdirSync(emptyDir, { recursive: true });

      const res1 = await inspectLock(nonExistent);
      expect(res1.status).toBe("unknown");

      const res2 = await inspectLock(emptyDir);
      expect(res2.status).toBe("unknown");
    });

    it("reapAbandonedLock cleans up abandoned directory and files", async () => {
      const abandoned = path.join(storageRoot, "abandoned.lock");
      fs.mkdirSync(abandoned, { recursive: true });
      fs.writeFileSync(path.join(abandoned, "owner.json"), "{}");

      await reapAbandonedLock(abandoned);
      expect(fs.existsSync(abandoned)).toBe(false);
    });
  });
});
