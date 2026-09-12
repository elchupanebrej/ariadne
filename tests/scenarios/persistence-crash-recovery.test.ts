import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { acquireRootLock, releaseLock, withRootLock, probeProcess } from "../../src/graph/lock.js";
import { scanAndRecoverJournal, rebuildProjections } from "../../src/graph/recovery.js";
import {
  createFrame,
  appendCanonicalRecord,
  appendGraphRecord,
  readFramedRecords,
  type FramedRecord,
} from "../../src/graph/journal.js";
import { AriadneError } from "../../src/core/errors.js";

describe("Scenario Suite 1: Persistence & Crash Recovery", () => {
  let tempDir: string;
  let storageRoot: string;
  let graphPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-persistence-scenario-"));
    storageRoot = path.join(tempDir, ".ariadne");
    fs.mkdirSync(storageRoot, { recursive: true });
    graphPath = path.join(storageRoot, "GRAPH.jsonl");
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Multi-Process Lock Contention & Atomic .ariadne/.lock Acquisition", () => {
    it("atomically acquires .ariadne/.lock and writes schemaVersion: 1 owner payload", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      const handle = await acquireRootLock(storageRoot);

      try {
        // Assert lock directory was atomically created
        expect(fs.existsSync(lockPath)).toBe(true);
        expect(handle.lockPath).toBe(fs.realpathSync(lockPath));
        expect(handle.pid).toBe(process.pid);
        expect(typeof handle.ownerToken).toBe("string");
        expect(typeof handle.acquiredAt).toBe("string");

        // Direct mkdir must fail with EEXIST (O_EXCL atomic semantics)
        await expect(fs.promises.mkdir(lockPath)).rejects.toMatchObject({
          code: "EEXIST",
        });

        // Verify owner.json payload format
        const ownerFile = path.join(lockPath, "owner.json");
        expect(fs.existsSync(ownerFile)).toBe(true);
        const ownerPayload = JSON.parse(await fs.promises.readFile(ownerFile, "utf8"));
        expect(ownerPayload).toMatchObject({
          schemaVersion: 1,
          pid: process.pid,
          ownerToken: handle.ownerToken,
          acquiredAt: handle.acquiredAt,
        });
      } finally {
        await handle.release();
      }

      // Assert lock directory and owner.json were cleanly removed upon release
      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it("serializes concurrent async contenders without data loss or race conditions", async () => {
      const contenderCount = 8;
      const initialFrame = createFrame(
        { kind: "node", node: { id: "ROOT-0", type: "HYP", provenance_type: "PROPOSED", statement: "Root" } },
        { sequence: 1 },
      );
      await appendCanonicalRecord(graphPath, initialFrame);

      // Launch multiple concurrent workers attempting to append records via executeWriteCycle
      const appendPromises = Array.from({ length: contenderCount }, (_, idx) => {
        const nodeId = `HYP-CONCURRENT-${idx + 1}`;
        return appendGraphRecord(storageRoot, {
          kind: "node",
          node: {
            id: nodeId,
            type: "HYP",
            provenance_type: "PROPOSED",
            statement: `Concurrent candidate ${idx + 1}`,
          },
        });
      });

      const results = await Promise.all(appendPromises);

      // All contenders must successfully commit
      for (const res of results) {
        expect(res.outcome).toBe("committed");
      }

      // Verify canonical journal has all records with strictly monotonic sequences 1..(contenderCount + 1)
      const records = await readFramedRecords(graphPath);
      expect(records.length).toBe(contenderCount + 1);

      const sequences = records.map((r) => r.sequence);
      const expectedSequences = Array.from({ length: contenderCount + 1 }, (_, i) => i + 1);
      expect(sequences).toEqual(expectedSequences);

      // Verify lock was cleanly released
      expect(fs.existsSync(path.join(storageRoot, ".lock"))).toBe(false);
    });

    it("handles inter-process contention where second process waits for first to release", async () => {
      const lockPath = path.join(storageRoot, ".lock");
      const readySignalFile = path.join(tempDir, "child-lock-ready.txt");
      const releaseSignalFile = path.join(tempDir, "release-lock.txt");

      // Spawn a real child process that acquires the lock, signals readiness, waits for release signal, then releases
      const childCode = `
        import fs from "node:fs";
        import path from "node:path";
        import { acquireRootLock } from "${path.resolve(process.cwd(), "dist/graph/lock.js")}";

        async function run() {
          const handle = await acquireRootLock(${JSON.stringify(storageRoot)});
          fs.writeFileSync(${JSON.stringify(readySignalFile)}, "READY", "utf8");

          // Poll for parent release signal
          while (!fs.existsSync(${JSON.stringify(releaseSignalFile)})) {
            await new Promise((r) => setTimeout(r, 20));
          }

          await handle.release();
          process.exit(0);
        }

        run().catch((err) => {
          console.error(err);
          process.exit(1);
        });
      `;

      const child = spawn(process.execPath, ["--input-type=module", "-e", childCode], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let childErrorOutput = "";
      child.stderr.on("data", (chunk) => {
        childErrorOutput += String(chunk);
      });

      try {
        // Wait for child to acquire lock and signal readiness
        const startWait = Date.now();
        while (!fs.existsSync(readySignalFile) && Date.now() - startWait < 5000) {
          await new Promise((r) => setTimeout(r, 25));
        }
        expect(fs.existsSync(readySignalFile)).toBe(true);
        expect(fs.existsSync(lockPath)).toBe(true);

        // Schedule release signal in 200ms
        setTimeout(() => {
          fs.writeFileSync(releaseSignalFile, "GO", "utf8");
        }, 200);

        // Parent attempts to acquire lock: should wait, then succeed once child releases
        const parentHandle = await acquireRootLock(storageRoot, {
          timeoutMs: 4000,
          pollIntervalMs: 25,
        });

        expect(parentHandle).toBeDefined();
        expect(parentHandle.pid).toBe(process.pid);
        await parentHandle.release();
      } finally {
        fs.writeFileSync(releaseSignalFile, "GO", "utf8");
        child.kill();
        if (childErrorOutput.length > 0 && !childErrorOutput.includes("SIGTERM")) {
          // ensure no uncaught child errors
        }
      }
    });
  });

  describe("PID-Absent Fast-Path vs PID-Alive Timeout", () => {
    it("reaps abandoned lock immediately via PID-absent fast path when process dies", async () => {
      const lockPath = path.join(storageRoot, ".lock");

      // Spawn a sacrificial process to obtain a valid real PID, then kill it
      const sacrificialChild = spawn(process.execPath, [
        "-e",
        "setInterval(() => {}, 1000);",
      ]);
      const deadPid = sacrificialChild.pid!;
      expect(deadPid).toBeGreaterThan(0);

      // Kill the sacrificial child immediately with SIGKILL
      sacrificialChild.kill("SIGKILL");
      await new Promise<void>((resolve) => {
        sacrificialChild.on("exit", () => resolve());
      });

      // Verify the process is definitively absent (ESRCH)
      expect(probeProcess(deadPid)).toBe("absent");

      // Simulate abandoned lock directory left behind by the dead process
      await fs.promises.mkdir(lockPath, { recursive: true });
      const abandonedPayload = {
        schemaVersion: 1,
        pid: deadPid,
        ownerToken: "abandoned-dead-process-token-1234",
        acquiredAt: new Date(Date.now() - 120_000).toISOString(),
      };
      await fs.promises.writeFile(
        path.join(lockPath, "owner.json"),
        JSON.stringify(abandonedPayload, null, 2) + "\n",
        "utf8",
      );

      // Attempt acquisition with a long timeout (5000ms).
      // The fast-path recovery MUST reclaim immediately without waiting 5000ms.
      const startTime = Date.now();
      const newHandle = await acquireRootLock(storageRoot, {
        timeoutMs: 5000,
        pollIntervalMs: 20,
      });
      const elapsedMs = Date.now() - startTime;

      try {
        expect(newHandle).toBeDefined();
        expect(newHandle.pid).toBe(process.pid);
        // Completed well under timeout because of fast-path recovery
        expect(elapsedMs).toBeLessThan(1500);

        // Verify owner.json now belongs to current process
        const currentPayload = JSON.parse(
          await fs.promises.readFile(path.join(lockPath, "owner.json"), "utf8"),
        );
        expect(currentPayload.pid).toBe(process.pid);
        expect(currentPayload.ownerToken).toBe(newHandle.ownerToken);
      } finally {
        await newHandle.release();
      }

      expect(fs.existsSync(lockPath)).toBe(false);
    });

    it("fails closed with LOCK_OWNERSHIP_UNCERTAIN on timeout when external PID is alive", async () => {
      const lockPath = path.join(storageRoot, ".lock");

      // Simulate a lock held by the current living process (process.pid)
      await fs.promises.mkdir(lockPath, { recursive: true });
      const livingPayload = {
        schemaVersion: 1,
        pid: process.pid,
        ownerToken: "external-living-worker-token-xyz",
        acquiredAt: new Date().toISOString(),
      };
      await fs.promises.writeFile(
        path.join(lockPath, "owner.json"),
        JSON.stringify(livingPayload, null, 2) + "\n",
        "utf8",
      );

      // Verify probe confirms process is alive
      expect(probeProcess(process.pid)).toBe("alive");

      // Attempt to acquire lock with short timeout (150ms)
      const shortTimeoutMs = 150;
      let caughtError: unknown;

      try {
        await acquireRootLock(storageRoot, {
          timeoutMs: shortTimeoutMs,
          pollIntervalMs: 25,
        });
      } catch (err) {
        caughtError = err;
      }

      try {
        expect(caughtError).toBeInstanceOf(AriadneError);
        const ariadneError = caughtError as AriadneError;
        expect(ariadneError.code).toBe("LOCK_OWNERSHIP_UNCERTAIN");
        expect(ariadneError.message).toContain(
          `Lock held by external process (PID ${process.pid}) could not be resolved within ${shortTimeoutMs}ms.`,
        );
        expect(ariadneError.repair).toBe(
          "Check for running ariadne processes or inspect .ariadne/.lock/owner.json.",
        );
        expect(ariadneError.detail).toMatchObject({
          lockPath: fs.realpathSync(lockPath),
          timeoutMs: shortTimeoutMs,
          ownerPid: process.pid,
        });

        // Strict No-Lock-Stealing Rule: verify lock was NOT stolen or deleted
        expect(fs.existsSync(lockPath)).toBe(true);
        const postCheckPayload = JSON.parse(
          await fs.promises.readFile(path.join(lockPath, "owner.json"), "utf8"),
        );
        expect(postCheckPayload.ownerToken).toBe("external-living-worker-token-xyz");
      } finally {
        // Clean up manual lock
        await fs.promises.rm(lockPath, { recursive: true, force: true });
      }
    });
  });

  describe("Torn Write Simulation & Incomplete Tail Truncation", () => {
    it("safely truncates torn write at EOF, emits INCOMPLETE_TAIL, and preserves all prior records", async () => {
      // 1. Commit two valid framed records
      const frame1 = createFrame(
        { kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } },
        { sequence: 1 },
      );
      const frame2 = createFrame(
        { kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 2" } },
        { sequence: 2 },
      );

      await appendCanonicalRecord(graphPath, frame1);
      await appendCanonicalRecord(graphPath, frame2);

      const verifiedSize = fs.statSync(graphPath).size;

      // 2. Simulate process crash / power halt mid-write: torn frame without trailing newline
      const tornBytes = '{"schemaVersion":1,"sequence":3,"payloadDigest":"9a8b7c';
      fs.appendFileSync(graphPath, tornBytes, "utf8");

      expect(fs.statSync(graphPath).size).toBe(
        verifiedSize + Buffer.byteLength(tornBytes, "utf8"),
      );

      // 3. Scan and recover
      const scanResult = await scanAndRecoverJournal(graphPath);

      expect(scanResult.recoveredTail).toBe(true);
      expect(scanResult.truncatedBytes).toBe(Buffer.byteLength(tornBytes, "utf8"));
      expect(scanResult.validRecords).toBe(2);
      expect(scanResult.lastSequence).toBe(2);
      expect(scanResult.diagnostic).toBeDefined();
      expect(scanResult.diagnostic?.code).toBe("INCOMPLETE_TAIL");
      expect(scanResult.diagnostic?.message).toContain("Incomplete final frame detected and safely truncated");
      expect(scanResult.records.length).toBe(2);

      // 4. Assert disk file size was restored to exact valid offset
      expect(fs.statSync(graphPath).size).toBe(verifiedSize);

      // 5. Subsequent write resumes seamlessly at sequence 3
      const frame3 = createFrame(
        { kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Resumed valid 3" } },
        { sequence: 3 },
      );
      await appendCanonicalRecord(graphPath, frame3);

      const secondScan = await scanAndRecoverJournal(graphPath);
      expect(secondScan.recoveredTail).toBe(false);
      expect(secondScan.validRecords).toBe(3);
      expect(secondScan.lastSequence).toBe(3);
      expect(secondScan.diagnostic).toBeUndefined();
    });

    it("refuses a complete checksum-invalid final frame without truncating it", async () => {
      const frame1 = createFrame(
        { kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "First valid" } },
        { sequence: 1 },
      );
      await appendCanonicalRecord(graphPath, frame1);
      const verifiedSize = fs.statSync(graphPath).size;

      // Append corrupt final frame with newline but invalid payload digest / CRC32
      const corruptFinalLine = JSON.stringify({
        schemaVersion: 1,
        sequence: 2,
        payloadDigest: "f".repeat(64),
        payloadLength: 15,
        crc32: 123456,
        timestamp: new Date().toISOString(),
        payload: { kind: "node", node: { id: "BAD-FINAL" } },
      }) + "\n";

      fs.appendFileSync(graphPath, corruptFinalLine, "utf8");

      await expect(scanAndRecoverJournal(graphPath)).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });
      expect(fs.statSync(graphPath).size).toBe(
        verifiedSize + Buffer.byteLength(corruptFinalLine, "utf8"),
      );
    });
  });

  describe("Middle-Log Corruption & Fail-Closed Behavior", () => {
    it("fails closed with CORRUPT_PERSISTED_HISTORY on tampered middle frame and strictly forbids truncation", async () => {
      const frame1 = createFrame(
        { kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } },
        { sequence: 1 },
      );
      const frame2 = createFrame(
        { kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 2" } },
        { sequence: 2 },
      );
      const frame3 = createFrame(
        { kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 3" } },
        { sequence: 3 },
      );

      // Tamper with frame 2 payload (invalidating digest and CRC)
      const tamperedFrame2 = {
        ...frame2,
        payload: {
          kind: "node",
          node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "TAMPERED VALUE" },
        },
      };

      await appendCanonicalRecord(graphPath, frame1);
      fs.appendFileSync(graphPath, JSON.stringify(tamperedFrame2) + "\n", "utf8");
      await appendCanonicalRecord(graphPath, frame3);

      const sizeBeforeScan = fs.statSync(graphPath).size;

      let caughtError: unknown;
      try {
        await scanAndRecoverJournal(graphPath);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AriadneError);
      const aError = caughtError as AriadneError;
      expect(aError.code).toBe("CORRUPT_PERSISTED_HISTORY");
      expect(aError.message).toContain("Middle corruption or checksum mismatch detected in canonical history");

      // CRITICAL: Disk file must NOT be truncated. Automatic truncation is prohibited for middle corruption.
      expect(fs.statSync(graphPath).size).toBe(sizeBeforeScan);
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY on malformed JSON in middle of log", async () => {
      const frame1 = createFrame(
        { kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } },
        { sequence: 1 },
      );
      const frame3 = createFrame(
        { kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 3" } },
        { sequence: 3 },
      );

      await appendCanonicalRecord(graphPath, frame1);
      fs.appendFileSync(graphPath, '{"broken JSON line without closing bracket\n', "utf8");
      await appendCanonicalRecord(graphPath, frame3);

      const sizeBefore = fs.statSync(graphPath).size;

      let caughtError: unknown;
      try {
        await scanAndRecoverJournal(graphPath);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AriadneError);
      expect((caughtError as AriadneError).code).toBe("CORRUPT_PERSISTED_HISTORY");
      expect(fs.statSync(graphPath).size).toBe(sizeBefore);
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY on middle sequence gap", async () => {
      const frame1 = createFrame(
        { kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } },
        { sequence: 1 },
      );
      const frame2Gapped = createFrame(
        { kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 2" } },
        { sequence: 10 }, // sequence gap
      );
      const frame3 = createFrame(
        { kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 3" } },
        { sequence: 11 },
      );

      await appendCanonicalRecord(graphPath, frame1);
      await appendCanonicalRecord(graphPath, frame2Gapped);
      await appendCanonicalRecord(graphPath, frame3);

      const sizeBefore = fs.statSync(graphPath).size;

      let caughtError: unknown;
      try {
        await scanAndRecoverJournal(graphPath);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AriadneError);
      expect((caughtError as AriadneError).code).toBe("CORRUPT_PERSISTED_HISTORY");
      expect(fs.statSync(graphPath).size).toBe(sizeBefore);
    });
  });

  describe("Projection Rebuild & Canonical Synchronization", () => {
    it("faithfully rebuilds STATE.yaml, INDEX.md, and cards/*.md from canonical GRAPH.jsonl and cleans up orphans", async () => {
      // 1. Build canonical authority state in GRAPH.jsonl
      const nodes = [
        { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", status: "ACTIVE", statement: "Hypothesis 1" },
        { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", status: "ACTIVE", statement: "Hypothesis 2" },
        { id: "UNK-1", type: "UNK", provenance_type: "UNKNOWN", status: "ACTIVE", statement: "Open Unknown 1" },
        { id: "DEC-1", type: "DEC", provenance_type: "DECIDED", status: "DECIDED", statement: "Decision 1" },
        { id: "EVD-1", type: "EVD", provenance_type: "MEASURED", status: "ACTIVE", statement: "Measured Evidence 1" },
      ];

      const edges = [
        { source: "HYP-1", type: "depends_on", target: "UNK-1" },
        { source: "EVD-1", type: "supports", target: "HYP-1" },
        { source: "DEC-1", type: "satisfies", target: "HYP-2" },
      ];

      let seq = 1;
      for (const node of nodes) {
        await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node }, { sequence: seq++ }));
      }
      for (const edge of edges) {
        await appendCanonicalRecord(graphPath, createFrame({ kind: "edge", edge }, { sequence: seq++ }));
      }

      // 2. Corrupt or scramble projections
      const statePath = path.join(storageRoot, "STATE.yaml");
      const indexPath = path.join(storageRoot, "INDEX.md");
      const cardsDir = path.join(storageRoot, "cards");
      fs.mkdirSync(cardsDir, { recursive: true });

      fs.writeFileSync(statePath, "{ corrupt: unparsable yaml/json content", "utf8");
      fs.writeFileSync(indexPath, "# Corrupted Index View", "utf8");

      // Create an orphaned card that no longer exists in GRAPH.jsonl
      fs.writeFileSync(path.join(cardsDir, "ORPHANED-OLD-NODE.md"), "Legacy ghost card", "utf8");

      // 3. Trigger rebuildProjections
      await rebuildProjections(storageRoot);

      // 4. Assert INDEX.md regenerated
      expect(fs.existsSync(indexPath)).toBe(true);
      const indexContent = fs.readFileSync(indexPath, "utf8");
      expect(indexContent).toContain("# Ariadne Epistemic Index");
      expect(indexContent).toContain("Nodes: 5 · Edges: 3");
      expect(indexContent).toContain("HYP-1");
      expect(indexContent).toContain("HYP-2");
      expect(indexContent).toContain("UNK-1");
      expect(indexContent).toContain("EVD-1");

      // 5. Assert cards/*.md generated for all 5 canonical nodes
      for (const node of nodes) {
        const cardPath = path.join(cardsDir, `${node.id}.md`);
        expect(fs.existsSync(cardPath)).toBe(true);
        const cardText = fs.readFileSync(cardPath, "utf8");
        expect(cardText).toContain(`# ${node.id}`);
        expect(cardText).toContain(node.statement);
      }

      // 6. Assert orphaned card was purged
      expect(fs.existsSync(path.join(cardsDir, "ORPHANED-OLD-NODE.md"))).toBe(false);

      // 7. Assert STATE.yaml regenerated with correct frontier and open unknowns
      expect(fs.existsSync(statePath)).toBe(true);
      const stateObj = JSON.parse(fs.readFileSync(statePath, "utf8"));
      expect(stateObj.schema_version).toBe(1);
      expect(stateObj.frontier).toContain("HYP-1");
      expect(stateObj.frontier).toContain("HYP-2");
      expect(stateObj.frontier).toContain("UNK-1");
      expect(stateObj.frontier).toContain("EVD-1");
      expect(stateObj.frontier).not.toContain("DEC-1"); // DEC-1 is terminal
      expect(stateObj.open_unknowns).toEqual(["UNK-1"]);
    });

    it("preserves adapter overlay fields across projection rebuild", async () => {
      const node = { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", status: "ACTIVE", statement: "H1" };
      await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node }, { sequence: 1 }));

      const statePath = path.join(storageRoot, "STATE.yaml");
      const initialOverlay = {
        mode: "gsd",
        depth_mode: "Deep",
        custom_phase: "phase-04",
      };
      fs.writeFileSync(statePath, JSON.stringify(initialOverlay, null, 2), "utf8");

      await rebuildProjections(storageRoot);

      const rebuiltState = JSON.parse(fs.readFileSync(statePath, "utf8"));
      expect(rebuiltState.mode).toBe("gsd");
      expect(rebuiltState.depth_mode).toBe("Deep");
      expect(rebuiltState.custom_phase).toBe("phase-04");
      expect(rebuiltState.schema_version).toBe(1);
      expect(rebuiltState.frontier).toEqual(["HYP-1"]);
    });
  });
});
