import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Writable } from "node:stream";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  migrateWorkspace,
  rollbackMigration,
  computeFileDigest,
  type MigrationManifest,
} from "../../src/graph/migration.js";
import { isLegacyWorkspace } from "../../src/graph/legacy.js";
import { verifyFrame, type FramedRecord } from "../../src/graph/journal.js";
import { AriadneError } from "../../src/core/errors.js";
import { runCli } from "../../src/cli/index.js";

const FIXTURE_ROOT = path.resolve(process.cwd(), "test/fixtures/legacy-v0");
const FIXTURE_ARIADNE = path.join(FIXTURE_ROOT, ".ariadne");
const FIXTURE_MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");

const capture = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  return { stream, text: () => output };
};

describe("Scenario Suite 2: Persisted-Format Migration", () => {
  let tempDir: string;
  let tempAriadne: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-format-migration-scenario-"));
    tempAriadne = path.join(tempDir, ".ariadne");
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("Frozen Legacy V0 Fixture Full Migration with Exact Entity Parity", () => {
    it("migrates all 280 nodes, 413 edges, 1 notice, and 280 cards from v0 to v1 with 100% fidelity", async () => {
      // 1. Copy frozen fixture into isolated temporary workspace
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      // Verify workspace is legacy v0 before migration
      expect(await isLegacyWorkspace(tempAriadne)).toBe(true);

      // Verify fixture manifest matches expectations
      const fixtureManifest = JSON.parse(fs.readFileSync(FIXTURE_MANIFEST_PATH, "utf8"));
      expect(fixtureManifest.entityCounts.nodes).toBe(280);
      expect(fixtureManifest.entityCounts.edges).toBe(413);
      expect(fixtureManifest.entityCounts.notices).toBe(1);
      expect(fixtureManifest.entityCounts.totalGraphRecords).toBe(881);

      // 2. Perform live migration
      const result = await migrateWorkspace(tempAriadne);

      expect(result.dryRun).toBe(false);
      expect(result.sourceFormat).toBe("v0");
      expect(result.targetFormat).toBe("v1");
      expect(result.entityCounts.nodes).toBe(280);
      expect(result.entityCounts.edges).toBe(413);
      expect(result.entityCounts.notices).toBe(1);

      // Workspace is now classified as V1
      expect(await isLegacyWorkspace(tempAriadne)).toBe(false);

      // 3. Inspect GRAPH.jsonl frames
      const graphLines = fs
        .readFileSync(path.join(tempAriadne, "GRAPH.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);

      expect(graphLines.length).toBe(881);

      let seq = 1;
      for (const line of graphLines) {
        const frame = JSON.parse(line) as FramedRecord;
        expect(frame.schemaVersion).toBe(1);
        expect(frame.sequence).toBe(seq++);
        expect(typeof frame.crc32).toBe("number");
        expect(typeof frame.payloadDigest).toBe("string");
        expect(verifyFrame(frame)).toBe(true);
      }

      // 4. Inspect NOTICES.jsonl frame
      const noticeLines = fs
        .readFileSync(path.join(tempAriadne, "NOTICES.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((l) => l.length > 0);

      expect(noticeLines.length).toBe(1);
      const noticeFrame = JSON.parse(noticeLines[0]) as FramedRecord;
      expect(noticeFrame.schemaVersion).toBe(1);
      expect(noticeFrame.sequence).toBe(1);
      expect(verifyFrame(noticeFrame)).toBe(true);

      // 5. Inspect STATE.yaml
      const stateObj = JSON.parse(fs.readFileSync(path.join(tempAriadne, "STATE.yaml"), "utf8"));
      expect(stateObj.schema_version).toBe(1);
      expect(Array.isArray(stateObj.frontier)).toBe(true);
      expect(Array.isArray(stateObj.open_unknowns)).toBe(true);

      // 6. Inspect INDEX.md
      const indexText = fs.readFileSync(path.join(tempAriadne, "INDEX.md"), "utf8");
      expect(indexText).toContain("# Ariadne Epistemic Index");
      expect(indexText).toContain("Nodes: 280");
      expect(indexText).toContain("Edges: 413");

      // 7. Inspect cards/*.md
      const cardFiles = fs.readdirSync(path.join(tempAriadne, "cards"));
      expect(cardFiles.length).toBe(280);
      for (const cardFile of cardFiles) {
        expect(cardFile.endsWith(".md")).toBe(true);
        const cardSize = fs.statSync(path.join(tempAriadne, "cards", cardFile)).size;
        expect(cardSize).toBeGreaterThan(10);
      }
    });
  });

  describe("Pre-Flight Dry Run Validation (--dry-run)", () => {
    it("reports exact predictions and entity counts without writing or modifying files", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      // Record pre-dry-run file hashes and timestamps
      const graphBeforeHash = (await computeFileDigest(path.join(tempAriadne, "GRAPH.jsonl"))).sha256;
      const stateBeforeHash = (await computeFileDigest(path.join(tempAriadne, "STATE.yaml"))).sha256;

      // Execute programmatic dry-run
      const dryResult = await migrateWorkspace(tempAriadne, { dryRun: true });

      expect(dryResult.dryRun).toBe(true);
      expect(dryResult.sourceFormat).toBe("v0");
      expect(dryResult.targetFormat).toBe("v1");
      expect(dryResult.entityCounts.nodes).toBe(280);
      expect(dryResult.entityCounts.edges).toBe(413);
      expect(dryResult.entityCounts.notices).toBe(1);

      // Verify predicted target stats
      expect(dryResult.predictedTarget).toBeDefined();
      expect(dryResult.predictedTarget!["GRAPH.jsonl"].estimatedRecords).toBe(881);
      expect(dryResult.predictedTarget!["NOTICES.jsonl"].estimatedRecords).toBe(1);
      expect(dryResult.predictedTarget!["cards/*.md"].estimatedRecords).toBe(280);

      // Verify zero disk modifications
      expect(await isLegacyWorkspace(tempAriadne)).toBe(true);
      expect(fs.existsSync(path.join(tempAriadne, "backups"))).toBe(false);
      expect(fs.existsSync(path.join(tempAriadne, "staging"))).toBe(false);

      const graphAfterHash = (await computeFileDigest(path.join(tempAriadne, "GRAPH.jsonl"))).sha256;
      const stateAfterHash = (await computeFileDigest(path.join(tempAriadne, "STATE.yaml"))).sha256;
      expect(graphAfterHash).toBe(graphBeforeHash);
      expect(stateAfterHash).toBe(stateBeforeHash);

      // Test CLI dry-run execution
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate", "--dry-run"], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(0);
      expect(stdout.text()).toContain("Migration Dry Run Summary:");
      expect(stdout.text()).toContain("Nodes: 280");
      expect(stdout.text()).toContain("Edges: 413");
      expect(stdout.text()).toContain("No files were written to disk.");
      expect(fs.existsSync(path.join(tempAriadne, "backups"))).toBe(false);
    });
  });

  describe("Backup Snapshot Verification & Verified Rollback", () => {
    it("creates immutable backup snapshot and rolls back cleanly to exact original v0 state", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      // Collect original v0 SHA-256 hashes for every file in fixture
      const fixtureManifest = JSON.parse(fs.readFileSync(FIXTURE_MANIFEST_PATH, "utf8"));
      const originalDigests: Record<string, string> = {};
      for (const relPath of Object.keys(fixtureManifest.files)) {
        const filePath = path.join(tempAriadne, relPath);
        const digest = await computeFileDigest(filePath);
        originalDigests[relPath] = digest.sha256;
      }

      // Execute migration
      const migrationResult = await migrateWorkspace(tempAriadne);
      expect(await isLegacyWorkspace(tempAriadne)).toBe(false);

      // Verify backup snapshot
      const backupDir = path.join(tempAriadne, "backups", migrationResult.migrationId);
      expect(fs.existsSync(backupDir)).toBe(true);

      const manifestPath = path.join(backupDir, "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);
      const backupManifest: MigrationManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(backupManifest.status).toBe("COMPLETE");
      expect(backupManifest.sourceFormat).toBe("v0");
      expect(backupManifest.targetFormat).toBe("v1");

      // Verify all backed up files have exact matching digests
      for (const [relPath, fileInfo] of Object.entries(backupManifest.files)) {
        const backedUpFilePath = path.join(backupDir, relPath);
        expect(fs.existsSync(backedUpFilePath)).toBe(true);
        const digest = await computeFileDigest(backedUpFilePath);
        expect(digest.sha256).toBe(fileInfo.sha256);
        expect(digest.sha256).toBe(originalDigests[relPath]);
      }

      // Execute rollback via CLI
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate", "--rollback", migrationResult.migrationId], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(0);
      expect(stdout.text()).toContain("Rollback Completed Successfully!");

      // Verify workspace is restored to legacy v0 state
      expect(await isLegacyWorkspace(tempAriadne)).toBe(true);

      // Verify every file matches original v0 hash byte-for-byte
      for (const [relPath, origHash] of Object.entries(originalDigests)) {
        const livePath = path.join(tempAriadne, relPath);
        expect(fs.existsSync(livePath)).toBe(true);
        const currentDigest = await computeFileDigest(livePath);
        expect(currentDigest.sha256).toBe(origHash);
      }
    });

    it("rejects rollback on tampered or corrupted backup file with CORRUPT_PERSISTED_HISTORY", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      const migrationResult = await migrateWorkspace(tempAriadne);
      const backupDir = path.join(tempAriadne, "backups", migrationResult.migrationId);

      // Tamper with a file in the backup snapshot
      const backedUpGraph = path.join(backupDir, "GRAPH.jsonl");
      fs.appendFileSync(backedUpGraph, "TAMPERED_BACKUP_CONTENT\n", "utf8");

      // Attempt rollback
      await expect(
        rollbackMigration(tempAriadne, migrationResult.migrationId),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("CORRUPT_PERSISTED_HISTORY");
        expect(aError.message).toContain("failed SHA-256 verification (corrupted backup)");
        return true;
      });
    });
  });

  describe("Crash Simulation at Staging & Checkpoints", () => {
    it("safely resumes migration when interrupted staging matches live source file digests", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      const migrationId = "MIG-CRASH-RESUME-001";
      const stagingDir = path.join(tempAriadne, "staging", migrationId);
      const backupDir = path.join(tempAriadne, "backups", migrationId);
      await fs.promises.mkdir(stagingDir, { recursive: true });
      await fs.promises.mkdir(backupDir, { recursive: true });

      // Compute current live source digests
      const graphDigest = await computeFileDigest(path.join(tempAriadne, "GRAPH.jsonl"));
      const noticesDigest = await computeFileDigest(path.join(tempAriadne, "NOTICES.jsonl"));
      const stateDigest = await computeFileDigest(path.join(tempAriadne, "STATE.yaml"));
      const indexDigest = await computeFileDigest(path.join(tempAriadne, "INDEX.md"));

      // Record a STAGED manifest pointing to live files
      const interruptedManifest: MigrationManifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: {
          "GRAPH.jsonl": graphDigest,
          "NOTICES.jsonl": noticesDigest,
          "STATE.yaml": stateDigest,
          "INDEX.md": indexDigest,
        },
        entityCounts: { nodes: 280, edges: 413, notices: 1 },
      };

      await fs.promises.writeFile(
        path.join(stagingDir, "manifest.json"),
        JSON.stringify(interruptedManifest, null, 2) + "\n",
        "utf8",
      );
      await fs.promises.writeFile(
        path.join(backupDir, "manifest.json"),
        JSON.stringify(interruptedManifest, null, 2) + "\n",
        "utf8",
      );

      // Re-running migration resumes and succeeds
      const result = await migrateWorkspace(tempAriadne, { migrationId });
      expect(result.dryRun).toBe(false);
      expect(result.entityCounts.nodes).toBe(280);
      expect(await isLegacyWorkspace(tempAriadne)).toBe(false);
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY when live source was altered during interrupted migration", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      const migrationId = "MIG-CRASH-TAMPER-002";
      const stagingDir = path.join(tempAriadne, "staging", migrationId);
      await fs.promises.mkdir(stagingDir, { recursive: true });

      const graphDigest = await computeFileDigest(path.join(tempAriadne, "GRAPH.jsonl"));
      const interruptedManifest: MigrationManifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: {
          "GRAPH.jsonl": graphDigest,
        },
        entityCounts: { nodes: 280, edges: 413, notices: 1 },
      };

      await fs.promises.writeFile(
        path.join(stagingDir, "manifest.json"),
        JSON.stringify(interruptedManifest, null, 2) + "\n",
        "utf8",
      );

      // Tamper with live source file GRAPH.jsonl after crash
      fs.appendFileSync(path.join(tempAriadne, "GRAPH.jsonl"), '{"extra":"tampered"}\n', "utf8");

      // Running migration must fail closed immediately
      await expect(
        migrateWorkspace(tempAriadne, { migrationId }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("CORRUPT_PERSISTED_HISTORY");
        expect(aError.message).toContain(
          `Source file 'GRAPH.jsonl' was altered since interrupted migration '${migrationId}'`,
        );
        return true;
      });
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY when live source file was removed during interrupted migration", async () => {
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      const migrationId = "MIG-CRASH-DELETED-003";
      const stagingDir = path.join(tempAriadne, "staging", migrationId);
      await fs.promises.mkdir(stagingDir, { recursive: true });

      const noticesDigest = await computeFileDigest(path.join(tempAriadne, "NOTICES.jsonl"));
      const interruptedManifest: MigrationManifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: {
          "NOTICES.jsonl": noticesDigest,
        },
        entityCounts: { nodes: 280, edges: 413, notices: 1 },
      };

      await fs.promises.writeFile(
        path.join(stagingDir, "manifest.json"),
        JSON.stringify(interruptedManifest, null, 2) + "\n",
        "utf8",
      );

      // Delete live source file NOTICES.jsonl
      fs.unlinkSync(path.join(tempAriadne, "NOTICES.jsonl"));

      // Running migration must fail closed immediately
      await expect(
        migrateWorkspace(tempAriadne, { migrationId }),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("CORRUPT_PERSISTED_HISTORY");
        expect(aError.message).toContain(
          `Source file 'NOTICES.jsonl' was removed since interrupted migration '${migrationId}'`,
        );
        return true;
      });
    });
  });

  describe("Detection and Rejection of Future/Unsupported Format Versions", () => {
    it("rejects GRAPH.jsonl with schemaVersion > 1 with AriadneError(UNSUPPORTED_FORMAT)", async () => {
      fs.mkdirSync(tempAriadne, { recursive: true });

      // Write a future/unsupported record (schemaVersion: 2)
      const futureRecord = JSON.stringify({
        schemaVersion: 2,
        sequence: 1,
        payload: {
          id: "HYP-FUTURE",
          type: "HYP",
          statement: "From future Ariadne v2.0",
        },
      }) + "\n";

      fs.writeFileSync(path.join(tempAriadne, "GRAPH.jsonl"), futureRecord, "utf8");

      await expect(
        migrateWorkspace(tempAriadne),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("UNSUPPORTED_FORMAT");
        expect(aError.message).toContain("GRAPH.jsonl contains unsupported schemaVersion: 2");
        expect(aError.repair).toContain("Upgrade Ariadne binary to support newer format version.");
        return true;
      });
    });

    it("rejects NOTICES.jsonl with schemaVersion > 1 with AriadneError(UNSUPPORTED_FORMAT)", async () => {
      fs.mkdirSync(tempAriadne, { recursive: true });

      const futureNotice = JSON.stringify({
        schemaVersion: 99,
        sequence: 1,
        payload: {
          id: "NOT-FUTURE",
          adapter: "gsd",
          event: "test",
        },
      }) + "\n";

      fs.writeFileSync(path.join(tempAriadne, "NOTICES.jsonl"), futureNotice, "utf8");

      await expect(
        migrateWorkspace(tempAriadne),
      ).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(AriadneError);
        const aError = err as AriadneError;
        expect(aError.code).toBe("UNSUPPORTED_FORMAT");
        expect(aError.message).toContain("NOTICES.jsonl contains unsupported schemaVersion: 99");
        return true;
      });
    });

    it("emits exit code 2 and structured error via CLI when detecting unsupported format version", async () => {
      fs.mkdirSync(tempAriadne, { recursive: true });

      const futureRecord = JSON.stringify({
        schemaVersion: 42,
        sequence: 1,
        payload: { test: true },
      }) + "\n";

      fs.writeFileSync(path.join(tempAriadne, "GRAPH.jsonl"), futureRecord, "utf8");

      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate"], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(2);
      expect(stderr.text()).toContain("UNSUPPORTED_FORMAT");
      expect(stderr.text()).toContain("GRAPH.jsonl contains unsupported schemaVersion: 42");
    });
  });
});
