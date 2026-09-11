import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect } from "vitest";
import {
  migrateWorkspace,
  rollbackMigration,
  computeFileDigest,
  type MigrationManifest,
} from "../../src/graph/migration.js";
import { isLegacyWorkspace } from "../../src/graph/legacy.js";
import { verifyFrame, type FramedRecord } from "../../src/graph/journal.js";

const FIXTURE_ROOT = path.resolve(process.cwd(), "test/fixtures/legacy-v0");
const FIXTURE_ARIADNE = path.join(FIXTURE_ROOT, ".ariadne");
const FIXTURE_MANIFEST_PATH = path.join(FIXTURE_ROOT, "manifest.json");

describe("Legacy V0 Golden Fixture Migration & Rollback Suite", () => {
  it("verifies frozen legacy-v0 golden fixture manifest matches disk state", async () => {
    expect(fs.existsSync(FIXTURE_MANIFEST_PATH)).toBe(true);
    expect(fs.existsSync(FIXTURE_ARIADNE)).toBe(true);

    const manifestContent = fs.readFileSync(FIXTURE_MANIFEST_PATH, "utf8");
    const manifest = JSON.parse(manifestContent);

    expect(manifest.sourceFormat).toBe("v0");
    expect(manifest.entityCounts.nodes).toBe(280);
    expect(manifest.entityCounts.edges).toBe(413);
    expect(manifest.entityCounts.notices).toBe(1);
    expect(manifest.entityCounts.totalGraphRecords).toBe(881);
    expect(manifest.entityCounts.cardCount).toBe(280);

    // Verify key files exist and match manifest digests
    for (const file of ["GRAPH.jsonl", "NOTICES.jsonl", "STATE.yaml", "INDEX.md"]) {
      const diskPath = path.join(FIXTURE_ARIADNE, file);
      expect(fs.existsSync(diskPath)).toBe(true);
      const digest = await computeFileDigest(diskPath);
      expect(digest.sha256).toBe(manifest.files[file].sha256);
      expect(digest.sizeBytes).toBe(manifest.files[file].sizeBytes);
    }
  });

  it("migrates legacy-v0 fixture with 100% preservation and rolls back cleanly", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-legacy-v0-golden-"));
    const tempAriadne = path.join(tempDir, ".ariadne");

    try {
      // 1. Copy frozen fixture into temporary workspace
      fs.cpSync(FIXTURE_ARIADNE, tempAriadne, { recursive: true });

      // Verify workspace is legacy v0 before migration
      const legacyBefore = await isLegacyWorkspace(tempAriadne);
      expect(legacyBefore).toBe(true);

      // Record pre-migration file hashes for exact comparison
      const manifest = JSON.parse(fs.readFileSync(FIXTURE_MANIFEST_PATH, "utf8"));
      const preDigests: Record<string, string> = {};
      for (const relPath of Object.keys(manifest.files)) {
        const filePath = path.join(tempAriadne, relPath);
        const digest = await computeFileDigest(filePath);
        preDigests[relPath] = digest.sha256;
        expect(digest.sha256).toBe(manifest.files[relPath].sha256);
      }

      // 2. Execute dry run against fixture copy
      const dryRunResult = await migrateWorkspace(tempAriadne, { dryRun: true });
      expect(dryRunResult.dryRun).toBe(true);
      expect(dryRunResult.sourceFormat).toBe("v0");
      expect(dryRunResult.targetFormat).toBe("v1");
      expect(dryRunResult.entityCounts.nodes).toBe(280);
      expect(dryRunResult.entityCounts.edges).toBe(413);
      expect(dryRunResult.entityCounts.notices).toBe(1);
      expect(dryRunResult.predictedTarget!["GRAPH.jsonl"].estimatedRecords).toBe(881);
      expect(dryRunResult.predictedTarget!["NOTICES.jsonl"].estimatedRecords).toBe(1);
      expect(dryRunResult.predictedTarget!["cards/*.md"].estimatedRecords).toBe(280);

      // Verify zero modification during dry run
      expect(await isLegacyWorkspace(tempAriadne)).toBe(true);
      expect(fs.existsSync(path.join(tempAriadne, "backups"))).toBe(false);

      // 3. Execute live migration
      const migrationResult = await migrateWorkspace(tempAriadne);
      expect(migrationResult.dryRun).toBe(false);
      expect(migrationResult.sourceFormat).toBe("v0");
      expect(migrationResult.targetFormat).toBe("v1");
      expect(migrationResult.entityCounts.nodes).toBe(280);
      expect(migrationResult.entityCounts.edges).toBe(413);
      expect(migrationResult.entityCounts.notices).toBe(1);

      // Workspace is now recognized as V1
      const legacyAfter = await isLegacyWorkspace(tempAriadne);
      expect(legacyAfter).toBe(false);

      // Verify backup directory created and manifest marked COMPLETE
      const backupDir = path.join(tempAriadne, "backups", migrationResult.migrationId);
      expect(fs.existsSync(backupDir)).toBe(true);
      const backupManifest: MigrationManifest = JSON.parse(
        fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8"),
      );
      expect(backupManifest.status).toBe("COMPLETE");
      expect(backupManifest.entityCounts.nodes).toBe(280);
      expect(backupManifest.entityCounts.edges).toBe(413);
      expect(backupManifest.entityCounts.notices).toBe(1);

      // 4. Inspect GRAPH.jsonl output
      const graphLines = fs
        .readFileSync(path.join(tempAriadne, "GRAPH.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      expect(graphLines.length).toBe(881);

      let expectedSeq = 1;
      for (const line of graphLines) {
        const frame = JSON.parse(line) as FramedRecord;
        expect(frame.schemaVersion).toBe(1);
        expect(frame.sequence).toBe(expectedSeq++);
        expect(frame.payload).toBeDefined();
        expect(frame.crc32).toBeDefined();
        expect(typeof frame.crc32).toBe("number");
        expect(frame.payloadDigest).toBeDefined();
        expect(verifyFrame(frame)).toBe(true);
      }

      // 5. Inspect NOTICES.jsonl output
      const noticeLines = fs
        .readFileSync(path.join(tempAriadne, "NOTICES.jsonl"), "utf8")
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      expect(noticeLines.length).toBe(1);
      const noticeFrame = JSON.parse(noticeLines[0]) as FramedRecord;
      expect(noticeFrame.schemaVersion).toBe(1);
      expect(noticeFrame.sequence).toBe(1);
      expect(verifyFrame(noticeFrame)).toBe(true);

      // 6. Inspect STATE.yaml output
      const stateObj = JSON.parse(fs.readFileSync(path.join(tempAriadne, "STATE.yaml"), "utf8"));
      expect(stateObj.schema_version).toBe(1);
      expect(Array.isArray(stateObj.frontier)).toBe(true);
      expect(Array.isArray(stateObj.open_unknowns)).toBe(true);

      // 7. Inspect INDEX.md and cards/
      const indexContent = fs.readFileSync(path.join(tempAriadne, "INDEX.md"), "utf8");
      expect(indexContent).toContain("# Ariadne Epistemic Index");
      expect(indexContent).toContain("Nodes: 280");
      expect(indexContent).toContain("Edges: 413");

      const cardFiles = fs.readdirSync(path.join(tempAriadne, "cards"));
      expect(cardFiles.length).toBe(280);

      // 8. Execute rollback
      const rollbackResult = await rollbackMigration(tempAriadne, migrationResult.migrationId);
      expect(rollbackResult.status).toBe("ROLLED_BACK");
      expect(rollbackResult.restoredFiles.length).toBe(Object.keys(manifest.files).length);

      // Verify workspace is restored to legacy v0 state
      const legacyAfterRollback = await isLegacyWorkspace(tempAriadne);
      expect(legacyAfterRollback).toBe(true);

      // Verify byte-for-byte SHA-256 match with original frozen fixture
      for (const [relPath, origHash] of Object.entries(preDigests)) {
        const restoredPath = path.join(tempAriadne, relPath);
        expect(fs.existsSync(restoredPath)).toBe(true);
        const restoredDigest = await computeFileDigest(restoredPath);
        expect(restoredDigest.sha256).toBe(origHash);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 30_000);
});
