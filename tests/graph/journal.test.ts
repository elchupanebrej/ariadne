import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { crc32 } from "node:zlib";
import { createHash } from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createFrame,
  createFramedRecord,
  verifyFrame,
  parseFramedRecord,
  readFramedRecords,
  appendCanonicalRecord,
  appendCanonicalRecords,
  stageAndSwapProjection,
  stageAndSwapProjections,
  getAttemptLedgerPath,
  appendAttemptEvent,
  readAttemptEvents,
  appendGraphRecord,
  appendNoticeRecord,
  executeWriteCycle,
  JournalWriter,
  type FramedRecord,
  type PersistenceOutcome,
} from "../../src/graph/journal.js";
import { AriadneError } from "../../src/core/errors.js";

describe("Journal persistence and atomic write cycle", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "ariadne-journal-test-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  describe("Framed journal envelope & hashing", () => {
    it("encodes valid framed records with sequence, length prefix, CRC32, and SHA-256", () => {
      const payload = {
        kind: "node",
        statement: "Ariadne reasoning substrate 🚀",
        symbols: ["€", "¥", "こんにちは"],
      };

      const frame = createFrame(payload, {
        sequence: 1,
        idempotencyKey: "idem-001",
      });

      expect(frame.schemaVersion).toBe(1);
      expect(frame.sequence).toBe(1);
      expect(frame.idempotencyKey).toBe("idem-001");
      expect(typeof frame.timestamp).toBe("string");

      const serialized = JSON.stringify(payload);
      const expectedLength = Buffer.byteLength(serialized, "utf8");
      const expectedDigest = createHash("sha256").update(serialized, "utf8").digest("hex");
      const expectedCrc = crc32(serialized);

      expect(frame.payloadLength).toBe(expectedLength);
      expect(frame.payloadDigest).toBe(expectedDigest);
      expect(frame.crc32).toBe(expectedCrc);
      expect(frame.payload).toEqual(payload);

      expect(verifyFrame(frame)).toBe(true);
    });

    it("verifies frames from serialized JSON string and object representations", () => {
      const frame = createFramedRecord({
        payload: { action: "invalidate", target: "OBS-01" },
        sequence: 5,
      });

      const jsonString = JSON.stringify(frame);
      expect(verifyFrame(jsonString)).toBe(true);
      expect(verifyFrame(frame)).toBe(true);
    });

    it("rejects tampered or corrupt frames in verifyFrame", () => {
      const payload = { data: "test-integrity" };
      const frame = createFrame(payload, { sequence: 1 });

      // Corrupt payloadLength
      expect(verifyFrame({ ...frame, payloadLength: frame.payloadLength + 1 })).toBe(false);

      // Corrupt CRC32
      expect(verifyFrame({ ...frame, crc32: frame.crc32 + 1 })).toBe(false);

      // Corrupt payloadDigest
      expect(
        verifyFrame({
          ...frame,
          payloadDigest: "0".repeat(64),
        }),
      ).toBe(false);

      // Corrupt payload content
      expect(
        verifyFrame({
          ...frame,
          payload: { data: "tampered" },
        }),
      ).toBe(false);

      // Invalid schemaVersion
      expect(verifyFrame({ ...frame, schemaVersion: 2 })).toBe(false);

      // Invalid sequence
      expect(verifyFrame({ ...frame, sequence: -1 })).toBe(false);

      // Non-object or null
      expect(verifyFrame(null)).toBe(false);
      expect(verifyFrame("not-json")).toBe(false);
      expect(verifyFrame({})).toBe(false);
    });

    it("parses valid JSON lines and fails closed with AriadneError on corruption", () => {
      const frame = createFrame({ id: "NODE-1" }, { sequence: 1 });
      const validLine = JSON.stringify(frame);

      const parsed = parseFramedRecord(validLine);
      expect(parsed).toEqual(frame);

      // Unparseable JSON line
      expect(() => parseFramedRecord("{\"kind\":")).toThrow(AriadneError);
      try {
        parseFramedRecord("{\"kind\":");
      } catch (err) {
        expect(err).toBeInstanceOf(AriadneError);
        expect((err as AriadneError).code).toBe("CORRUPT_PERSISTED_HISTORY");
      }

      // Checksum corrupted line
      const corruptFrame = { ...frame, crc32: 999999 };
      expect(() => parseFramedRecord(JSON.stringify(corruptFrame))).toThrow(AriadneError);
      try {
        parseFramedRecord(JSON.stringify(corruptFrame));
      } catch (err) {
        expect(err).toBeInstanceOf(AriadneError);
        expect((err as AriadneError).code).toBe("CORRUPT_PERSISTED_HISTORY");
      }
    });

    it("rejects non-JSON serializable payload with AriadneError(INVALID_INPUT)", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      expect(() => createFrame(circular, { sequence: 1 })).toThrow(AriadneError);
      try {
        createFrame(circular, { sequence: 1 });
      } catch (err) {
        expect(err).toBeInstanceOf(AriadneError);
        expect((err as AriadneError).code).toBe("INVALID_INPUT");
      }
    });
  });

  describe("Canonical append and FileHandle.sync() commit point", () => {
    it("appends framed records and establishes commit point via handle.sync()", async () => {
      const targetFile = path.join(tempDir, "GRAPH.jsonl");
      const frame1 = createFrame({ id: "TASK-1" }, { sequence: 1 });
      const frame2 = createFrame({ id: "TASK-2" }, { sequence: 2 });

      let syncCallCount = 0;
      const customSync = async (handle: fs.promises.FileHandle) => {
        syncCallCount += 1;
        await handle.sync();
      };

      await appendCanonicalRecord(targetFile, frame1, { syncFn: customSync });
      expect(syncCallCount).toBe(1);

      await appendCanonicalRecord(targetFile, frame2, { syncFn: customSync });
      expect(syncCallCount).toBe(2);

      const records = await readFramedRecords(targetFile);
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(frame1);
      expect(records[1]).toEqual(frame2);
    });

    it("supports batch appending with a single sync point", async () => {
      const targetFile = path.join(tempDir, "GRAPH.jsonl");
      const frames = [
        createFrame({ id: "N-1" }, { sequence: 1 }),
        createFrame({ id: "N-2" }, { sequence: 2 }),
        createFrame({ id: "N-3" }, { sequence: 3 }),
      ];

      let syncCount = 0;
      await appendCanonicalRecords(targetFile, frames, {
        syncFn: async (h) => {
          syncCount += 1;
          await h.sync();
        },
      });

      expect(syncCount).toBe(1);
      const read = await readFramedRecords(targetFile);
      expect(read).toHaveLength(3);
      expect(read.map((r) => r.sequence)).toEqual([1, 2, 3]);
    });

    it("returns empty array when reading non-existent authority file", async () => {
      const missing = path.join(tempDir, "DOES_NOT_EXIST.jsonl");
      const records = await readFramedRecords(missing);
      expect(records).toEqual([]);
    });
  });

  describe("Idempotency key handling", () => {
    it("returns existing committed outcome cleanly when idempotencyKey and digest match", async () => {
      const payload = { operation: "register-node", id: "NODE-100" };
      const idempotencyKey = "idem-reg-100";

      const firstOutcome = await appendGraphRecord(tempDir, payload, {
        idempotencyKey,
      });

      expect(firstOutcome.outcome).toBe("committed");
      if (firstOutcome.outcome === "committed") {
        expect(firstOutcome.sequence).toBe(1);
        expect(firstOutcome.result).toEqual(payload);
      }

      // Re-submit with identical idempotencyKey and identical payload
      const secondOutcome = await appendGraphRecord(tempDir, payload, {
        idempotencyKey,
      });

      expect(secondOutcome.outcome).toBe("committed");
      if (secondOutcome.outcome === "committed") {
        expect(secondOutcome.sequence).toBe(1);
        expect(secondOutcome.result).toEqual(payload);
      }

      // Verify that no duplicate line was written to GRAPH.jsonl
      const records = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(records).toHaveLength(1);
    });

    it("throws AriadneError(IDEMPOTENCY_CONFLICT) when idempotencyKey is reused with different payload digest", async () => {
      const payloadA = { task: "setup", version: 1 };
      const payloadB = { task: "setup", version: 2 }; // different digest!
      const idempotencyKey = "idem-conflict-key";

      const outcomeA = await appendGraphRecord(tempDir, payloadA, {
        idempotencyKey,
      });
      expect(outcomeA.outcome).toBe("committed");

      // Attempt to reuse idempotencyKey with conflicting payload
      await expect(
        appendGraphRecord(tempDir, payloadB, { idempotencyKey }),
      ).rejects.toThrow(AriadneError);

      try {
        await appendGraphRecord(tempDir, payloadB, { idempotencyKey });
      } catch (err) {
        expect(err).toBeInstanceOf(AriadneError);
        const aerr = err as AriadneError;
        expect(aerr.code).toBe("IDEMPOTENCY_CONFLICT");
        expect(aerr.message).toBe(
          `Idempotency key '${idempotencyKey}' reused with different payload digest`,
        );
      }

      // Verify journal still contains only the original record
      const records = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(records).toHaveLength(1);
      expect(records[0].payload).toEqual(payloadA);
    });
  });

  describe("Derived projections atomic staging and swap", () => {
    it("stages projections in sibling temporary files and atomically renames over targets", async () => {
      const indexPath = path.join(tempDir, "INDEX.md");
      const statePath = path.join(tempDir, "STATE.yaml");
      const cardPath = path.join(tempDir, "cards", "TASK-001.md");

      const projections = [
        { path: indexPath, content: "# Ariadne Epistemic Index\n" },
        { path: statePath, content: "schema_version: 1\nfrontier: []\n" },
        { path: cardPath, content: "# TASK-001\nStatus: ACTIVE\n" },
      ];

      await stageAndSwapProjections(tempDir, projections);

      // Verify all projection files exist and match content
      expect(await fs.promises.readFile(indexPath, "utf8")).toBe("# Ariadne Epistemic Index\n");
      expect(await fs.promises.readFile(statePath, "utf8")).toBe("schema_version: 1\nfrontier: []\n");
      expect(await fs.promises.readFile(cardPath, "utf8")).toBe("# TASK-001\nStatus: ACTIVE\n");

      // Verify no temporary files remain in root or cards directory
      const rootEntries = await fs.promises.readdir(tempDir);
      expect(rootEntries.some((e) => e.startsWith(".tmp."))).toBe(false);

      const cardsEntries = await fs.promises.readdir(path.join(tempDir, "cards"));
      expect(cardsEntries.some((e) => e.startsWith(".tmp."))).toBe(false);
    });

    it("cleans up temporary sibling file if rename fails", async () => {
      const target = path.join(tempDir, "STATE.yaml");

      // Spy on rename to simulate failure
      const originalRename = fs.promises.rename;
      vi.spyOn(fs.promises, "rename").mockImplementationOnce(async () => {
        throw new Error("Simulated rename atomic swap failure");
      });

      await expect(stageAndSwapProjection(tempDir, target, "content")).rejects.toThrow(
        "Simulated rename atomic swap failure",
      );

      // Sibling temp file should be removed
      const files = await fs.promises.readdir(tempDir);
      expect(files.some((f) => f.startsWith(".tmp."))).toBe(false);

      vi.restoreAllMocks();
    });
  });

  describe("Explicit 4-discriminant persistence outcomes", () => {
    it("returns 'committed' on happy path mutation", async () => {
      const payload = { kind: "node", id: "HYP-01" };
      const outcome = await executeWriteCycle({
        storageRoot: tempDir,
        payload,
        result: { acknowledged: true },
        projections: [
          { path: path.join(tempDir, "STATE.yaml"), content: "mode: standalone\n" },
        ],
      });

      expect(outcome.outcome).toBe("committed");
      if (outcome.outcome === "committed") {
        expect(outcome.sequence).toBe(1);
        expect(outcome.result).toEqual({ acknowledged: true });
        expect(outcome.record?.payload).toEqual(payload);
      }

      // Verify canonical file and projection are durable
      const graph = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(graph).toHaveLength(1);
      expect(await fs.promises.readFile(path.join(tempDir, "STATE.yaml"), "utf8")).toBe(
        "mode: standalone\n",
      );
    });

    it("returns 'committed_with_recovery_needed' when canonical append syncs but projections fail", async () => {
      const payload = { kind: "node", id: "HYP-02" };

      const outcome = await executeWriteCycle({
        storageRoot: tempDir,
        payload,
        result: "success-result",
        projections: [
          { path: path.join(tempDir, "STATE.yaml"), content: "mode: standalone\n" },
        ],
        projectionErrorSimulator: () => {
          throw new Error("Simulated projection write error after commit point");
        },
      });

      expect(outcome.outcome).toBe("committed_with_recovery_needed");
      if (outcome.outcome === "committed_with_recovery_needed") {
        expect(outcome.sequence).toBe(1);
        expect(outcome.result).toBe("success-result");
        expect(outcome.error.message).toContain("Simulated projection write error");
      }

      // Canonical record MUST be committed to physical disk!
      const graph = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(graph).toHaveLength(1);
      expect(graph[0].payload).toEqual(payload);
    });

    it("returns 'not_committed' when pre-validation fails before canonical append", async () => {
      const outcome = await executeWriteCycle({
        storageRoot: tempDir,
        payload: { invalid: true },
        preValidate: () => {
          throw new AriadneError({
            code: "INVARIANT_VIOLATION",
            message: "Detected deductive cycle prior to commit",
          });
        },
      });

      expect(outcome.outcome).toBe("not_committed");
      if (outcome.outcome === "not_committed") {
        expect(outcome.code).toBe("INVARIANT_VIOLATION");
        expect(outcome.error.message).toContain("Detected deductive cycle");
      }

      // Canonical authority remains pristine
      const graph = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(graph).toHaveLength(0);
    });

    it("returns 'not_committed' on root lock contention / timeout", async () => {
      // Simulate lock contention by creating a locked directory with active PID
      const lockDir = path.join(tempDir, ".lock");
      await fs.promises.mkdir(lockDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(lockDir, "owner.json"),
        JSON.stringify({
          schemaVersion: 1,
          pid: process.pid, // Process is alive!
          ownerToken: "contending-token",
          acquiredAt: new Date().toISOString(),
        }),
      );

      const outcome = await executeWriteCycle({
        storageRoot: tempDir,
        payload: { kind: "node" },
        lockOptions: { timeoutMs: 50, pollIntervalMs: 10 },
      });

      expect(outcome.outcome).toBe("not_committed");
      if (outcome.outcome === "not_committed") {
        expect(outcome.code).toBe("LOCK_OWNERSHIP_UNCERTAIN");
      }

      // Canonical file was not touched
      const graph = await readFramedRecords(path.join(tempDir, "GRAPH.jsonl"));
      expect(graph).toHaveLength(0);
    });

    it("returns 'commit_unknown' when error occurs during canonical append / sync()", async () => {
      const outcome = await executeWriteCycle({
        storageRoot: tempDir,
        payload: { kind: "edge" },
        syncFn: async () => {
          throw new Error("Simulated I/O failure during physical disk sync");
        },
      });

      expect(outcome.outcome).toBe("commit_unknown");
      if (outcome.outcome === "commit_unknown") {
        expect(outcome.code).toBe("COMMIT_UNKNOWN");
        expect(outcome.error.message).toContain("Simulated I/O failure during physical disk sync");
      }
    });
  });

  describe("Dedicated orchestration attempt ledgers", () => {
    it("writes pointer-only events to .orchestration/attempts/<id>.jsonl isolated from domain graph", async () => {
      const attemptId = "att-20260907-001";
      const event1 = {
        kind: "attempt_dispatch",
        attemptId,
        dispatchId: "DSP-01",
        pointer: "nodes/TASK-01",
      };
      const event2 = {
        kind: "attempt_receipt",
        attemptId,
        receiptId: "RCPT-01",
        verdict: "success",
      };

      const outcome1 = await appendAttemptEvent(tempDir, attemptId, event1);
      expect(outcome1.outcome).toBe("committed");
      if (outcome1.outcome === "committed") {
        expect(outcome1.sequence).toBe(1);
      }

      const outcome2 = await appendAttemptEvent(tempDir, attemptId, event2);
      expect(outcome2.outcome).toBe("committed");
      if (outcome2.outcome === "committed") {
        expect(outcome2.sequence).toBe(2);
      }

      // Verify attempt ledger contains both events
      const attemptEvents = await readAttemptEvents(tempDir, attemptId);
      expect(attemptEvents).toHaveLength(2);
      expect(attemptEvents[0].payload).toEqual(event1);
      expect(attemptEvents[1].payload).toEqual(event2);

      // Verify GRAPH.jsonl does NOT exist and domain graph was NOT polluted
      const graphExists = fs.existsSync(path.join(tempDir, "GRAPH.jsonl"));
      expect(graphExists).toBe(false);

      const attemptLedgerPath = getAttemptLedgerPath(tempDir, attemptId);
      expect(attemptLedgerPath).toBe(
        path.join(tempDir, ".orchestration", "attempts", `${attemptId}.jsonl`),
      );
    });

    it("isolates multiple concurrent attempt ledgers", async () => {
      await appendAttemptEvent(tempDir, "attempt-A", { id: "event-A" });
      await appendAttemptEvent(tempDir, "attempt-B", { id: "event-B" });

      const eventsA = await readAttemptEvents(tempDir, "attempt-A");
      const eventsB = await readAttemptEvents(tempDir, "attempt-B");

      expect(eventsA).toHaveLength(1);
      expect(eventsA[0].payload).toEqual({ id: "event-A" });

      expect(eventsB).toHaveLength(1);
      expect(eventsB[0].payload).toEqual({ id: "event-B" });
    });

    it("rejects attempt IDs attempting directory traversal with AriadneError(INVALID_INPUT)", () => {
      expect(() => getAttemptLedgerPath(tempDir, "../escaped-attempt")).toThrow(AriadneError);
      expect(() => getAttemptLedgerPath(tempDir, "attempt/with/slashes")).toThrow(AriadneError);
      expect(() => getAttemptLedgerPath(tempDir, "")).toThrow(AriadneError);
    });
  });

  describe("JournalWriter object-oriented engine", () => {
    it("manages graph records, operational notices, and attempts via unified instance", async () => {
      const journal = new JournalWriter(tempDir);

      // 1. Domain graph record
      const graphOutcome = await journal.appendGraph({ kind: "node", id: "NODE-1" });
      expect(graphOutcome.outcome).toBe("committed");

      // 2. Operational notice
      const noticeOutcome = await journal.appendNotice({
        kind: "operational_notice",
        id: "NOT-01",
        falsified_id: "HYP-01",
      });
      expect(noticeOutcome.outcome).toBe("committed");

      // 3. Orchestration attempt
      const attemptOutcome = await journal.appendAttempt("att-xyz", {
        step: "dispatch",
      });
      expect(attemptOutcome.outcome).toBe("committed");

      // Read back
      const graphRecords = await journal.readGraph();
      expect(graphRecords).toHaveLength(1);

      const noticeRecords = await journal.readNotices();
      expect(noticeRecords).toHaveLength(1);

      const attemptRecords = await journal.readAttempt("att-xyz");
      expect(attemptRecords).toHaveLength(1);
    });
  });
});
