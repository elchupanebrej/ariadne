import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Writable } from "node:stream";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  migrateWorkspace,
  rollbackMigration,
  computeFileDigest,
  type MigrationManifest,
} from "../../src/graph/migration.js";
import { isLegacyWorkspace } from "../../src/graph/legacy.js";
import { readFramedRecords, type FramedRecord } from "../../src/graph/journal.js";
import { AriadneError } from "../../src/core/errors.js";
import { runCli } from "../../src/cli/index.js";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";

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

describe("Persisted-Format Migration Engine", () => {
  let tempDir: string;
  let ariadneDir: string;
  let rootGitignore: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-migrate-test-")));
    ariadneDir = path.join(tempDir, ".ariadne");
    fs.mkdirSync(ariadneDir, { recursive: true });

    rootGitignore = path.join(tempDir, ".gitignore");
    fs.writeFileSync(rootGitignore, "node_modules/\ndist/\n", "utf8");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createLegacyFixture() {
    const node1 = {
      kind: "node",
      node: {
        id: "HYP-1",
        type: "HYP",
        provenance_type: "PROPOSED",
        status: "ACTIVE",
        statement: "Legacy hypothesis 1",
        created_at: "2026-08-01T10:00:00.000Z",
      },
    };
    const node2 = {
      kind: "node",
      node: {
        id: "UNK-1",
        type: "UNK",
        provenance_type: "UNKNOWN",
        status: "ACTIVE",
        statement: "Legacy unknown 1",
        created_at: "2026-08-01T10:05:00.000Z",
      },
    };
    const edge1 = {
      kind: "edge",
      edge: {
        source: "HYP-1",
        type: "depends_on",
        target: "UNK-1",
      },
    };

    const graphContent = `${JSON.stringify(node1)}\n${JSON.stringify(node2)}\n${JSON.stringify(edge1)}\n`;
    fs.writeFileSync(path.join(ariadneDir, "GRAPH.jsonl"), graphContent, "utf8");

    const notice1 = {
      kind: "operational_notice",
      id: "NOT-001",
      falsified_id: "ASM-1",
      evidence_id: "EVD-1",
      affected_ids: ["ASM-1", "HYP-1"],
      reason: "Evidence falsifies premise",
      message: "Notice message",
      created_at: "2026-08-01T11:00:00.000Z",
    };
    fs.writeFileSync(path.join(ariadneDir, "NOTICES.jsonl"), `${JSON.stringify(notice1)}\n`, "utf8");

    const stateObj = {
      mode: "standalone",
      depth_mode: "Standard",
      custom_adapter_overlay: { key: "persisted_value" },
      frontier: ["HYP-1", "UNK-1"],
      open_unknowns: ["UNK-1"],
    };
    fs.writeFileSync(path.join(ariadneDir, "STATE.yaml"), JSON.stringify(stateObj, null, 2) + "\n", "utf8");

    fs.writeFileSync(path.join(ariadneDir, "INDEX.md"), "# Old Index\n", "utf8");

    const cardsDir = path.join(ariadneDir, "cards");
    fs.mkdirSync(cardsDir, { recursive: true });
    fs.writeFileSync(path.join(cardsDir, "HYP-1.md"), "# HYP-1\n", "utf8");
    fs.writeFileSync(path.join(cardsDir, "UNK-1.md"), "# UNK-1\n", "utf8");
  }

  describe("Dry Run (--dry-run)", () => {
    it("reports entity counts, digests, and predicted target records without mutating disk", async () => {
      createLegacyFixture();

      const initialFiles = fs.readdirSync(ariadneDir);
      const graphStatBefore = fs.statSync(path.join(ariadneDir, "GRAPH.jsonl"));
      const gitignoreBefore = fs.readFileSync(rootGitignore, "utf8");

      const result = await migrateWorkspace(ariadneDir, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.sourceFormat).toBe("v0");
      expect(result.targetFormat).toBe("v1");
      expect(result.entityCounts.nodes).toBe(2);
      expect(result.entityCounts.edges).toBe(1);
      expect(result.entityCounts.notices).toBe(1);
      expect(result.sourceFiles["GRAPH.jsonl"]).toBeDefined();
      expect(result.sourceFiles["NOTICES.jsonl"]).toBeDefined();
      expect(result.sourceFiles["STATE.yaml"]).toBeDefined();
      expect(result.predictedTarget).toBeDefined();
      expect(result.predictedTarget!["GRAPH.jsonl"].estimatedRecords).toBe(3);
      expect(result.predictedTarget!["NOTICES.jsonl"].estimatedRecords).toBe(1);

      // Verify ZERO disk mutation
      expect(fs.readdirSync(ariadneDir)).toEqual(initialFiles);
      expect(fs.statSync(path.join(ariadneDir, "GRAPH.jsonl")).mtimeMs).toBe(graphStatBefore.mtimeMs);
      expect(fs.existsSync(path.join(ariadneDir, "backups"))).toBe(false);
      expect(fs.existsSync(path.join(ariadneDir, "staging"))).toBe(false);
      expect(fs.existsSync(path.join(ariadneDir, ".lock"))).toBe(false);
      expect(fs.readFileSync(rootGitignore, "utf8")).toBe(gitignoreBefore);
    });
  });

  describe("Full Migration", () => {
    it("converts legacy records into V1 framed records, creates immutable backup, and updates .gitignore", async () => {
      createLegacyFixture();

      expect(await isLegacyWorkspace(ariadneDir)).toBe(true);

      const result = await migrateWorkspace(ariadneDir);

      expect(result.dryRun).toBe(false);
      expect(result.sourceFormat).toBe("v0");
      expect(result.targetFormat).toBe("v1");
      expect(result.entityCounts.nodes).toBe(2);
      expect(result.entityCounts.edges).toBe(1);
      expect(result.entityCounts.notices).toBe(1);

      // Verify backup directory created
      const backupDir = path.join(ariadneDir, "backups", result.migrationId);
      expect(fs.existsSync(backupDir)).toBe(true);

      const manifestPath = path.join(backupDir, "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(manifest.migrationId).toBe(result.migrationId);
      expect(manifest.status).toBe("COMPLETE");
      expect(manifest.sourceFormat).toBe("v0");
      expect(manifest.targetFormat).toBe("v1");
      expect(manifest.files["GRAPH.jsonl"]).toBeDefined();
      expect(manifest.files["STATE.yaml"]).toBeDefined();

      // Verify backup files match original source digests
      const backedUpGraphDigest = await computeFileDigest(path.join(backupDir, "GRAPH.jsonl"));
      expect(backedUpGraphDigest.sha256).toBe(manifest.files["GRAPH.jsonl"].sha256);

      // Verify .gitignore entry added
      const gitignoreContent = fs.readFileSync(rootGitignore, "utf8");
      expect(gitignoreContent).toContain(".ariadne/backups/");

      // Verify staging directory was cleaned up
      const stagingDir = path.join(ariadneDir, "staging", result.migrationId);
      expect(fs.existsSync(stagingDir)).toBe(false);

      // Verify live workspace is now recognized as V1 (NOT legacy)
      expect(await isLegacyWorkspace(ariadneDir)).toBe(false);

      // Verify GRAPH.jsonl contains valid V1 framed records
      const frames = await readFramedRecords(path.join(ariadneDir, "GRAPH.jsonl"));
      expect(frames.length).toBe(3);

      for (let i = 0; i < frames.length; i += 1) {
        const frame = frames[i];
        expect(frame.schemaVersion).toBe(1);
        expect(frame.sequence).toBe(i + 1);
        expect(typeof frame.crc32).toBe("number");
        expect(frame.payloadDigest).toMatch(/^[0-9a-f]{64}$/i);
        expect(frame.payloadLength).toBeGreaterThan(0);
      }

      // Verify 100% preservation of nodes and edges
      const nodeFrames = frames.filter((f) => (f.payload as any).kind === "node");
      expect(nodeFrames.length).toBe(2);
      expect((nodeFrames[0].payload as any).node.id).toBe("HYP-1");
      expect((nodeFrames[0].payload as any).node.statement).toBe("Legacy hypothesis 1");
      expect((nodeFrames[1].payload as any).node.id).toBe("UNK-1");
      expect((nodeFrames[1].payload as any).node.statement).toBe("Legacy unknown 1");

      const edgeFrames = frames.filter((f) => (f.payload as any).kind === "edge");
      expect(edgeFrames.length).toBe(1);
      expect((edgeFrames[0].payload as any).edge.source).toBe("HYP-1");
      expect((edgeFrames[0].payload as any).edge.type).toBe("depends_on");
      expect((edgeFrames[0].payload as any).edge.target).toBe("UNK-1");

      // Verify NOTICES.jsonl contains valid V1 framed notice
      const noticeFrames = await readFramedRecords(path.join(ariadneDir, "NOTICES.jsonl"));
      expect(noticeFrames.length).toBe(1);
      expect(noticeFrames[0].schemaVersion).toBe(1);
      expect(noticeFrames[0].idempotencyKey).toBe("operational-notice:ASM-1:EVD-1");
      expect((noticeFrames[0].payload as any).id).toBe("NOT-001");

      // Verify STATE.yaml has schema_version: 1 and preserved overlay fields
      const stateContent = JSON.parse(fs.readFileSync(path.join(ariadneDir, "STATE.yaml"), "utf8"));
      expect(stateContent.schema_version).toBe(1);
      expect(stateContent.mode).toBe("standalone");
      expect(stateContent.depth_mode).toBe("Standard");
      expect(stateContent.custom_adapter_overlay).toEqual({ key: "persisted_value" });

      // Verify INDEX.md and cards/ were rebuilt
      const indexContent = fs.readFileSync(path.join(ariadneDir, "INDEX.md"), "utf8");
      expect(indexContent).toContain("# Ariadne Epistemic Index");
      expect(indexContent).toContain("HYP-1");

      const hypCard = fs.readFileSync(path.join(ariadneDir, "cards", "HYP-1.md"), "utf8");
      expect(hypCard).toContain("# HYP-1");
      expect(hypCard).toContain("Legacy hypothesis 1");
    });
  });

  describe("Rollback Migration", () => {
    it("safely restores workspace back to original v0 state from immutable backup snapshot", async () => {
      createLegacyFixture();

      const initialGraphContent = fs.readFileSync(path.join(ariadneDir, "GRAPH.jsonl"), "utf8");
      const initialGraphDigest = await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl"));
      const initialStateContent = fs.readFileSync(path.join(ariadneDir, "STATE.yaml"), "utf8");

      // Step 1: Migrate
      const migrationResult = await migrateWorkspace(ariadneDir);
      expect(await isLegacyWorkspace(ariadneDir)).toBe(false);

      // Step 2: Rollback
      const rollbackResult = await rollbackMigration(ariadneDir, migrationResult.migrationId);
      expect(rollbackResult.migrationId).toBe(migrationResult.migrationId);
      expect(rollbackResult.status).toBe("ROLLED_BACK");
      expect(rollbackResult.restoredFiles).toContain("GRAPH.jsonl");
      expect(rollbackResult.restoredFiles).toContain("STATE.yaml");

      // Step 3: Verify workspace is back to v0 legacy
      expect(await isLegacyWorkspace(ariadneDir)).toBe(true);

      const restoredGraphContent = fs.readFileSync(path.join(ariadneDir, "GRAPH.jsonl"), "utf8");
      expect(restoredGraphContent).toBe(initialGraphContent);
      const restoredGraphDigest = await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl"));
      expect(restoredGraphDigest.sha256).toBe(initialGraphDigest.sha256);

      const restoredStateContent = fs.readFileSync(path.join(ariadneDir, "STATE.yaml"), "utf8");
      expect(restoredStateContent).toBe(initialStateContent);

      // Verify manifest was marked ROLLED_BACK
      const backupDir = path.join(ariadneDir, "backups", migrationResult.migrationId);
      const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8"));
      expect(manifest.status).toBe("ROLLED_BACK");
    });

    it("throws MISSING_DATA when rollback migration ID does not exist", async () => {
      createLegacyFixture();
      await expect(rollbackMigration(ariadneDir, "MIG-nonexistent-12345")).rejects.toThrowError(
        expect.objectContaining({ code: "MISSING_DATA" }),
      );
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY if backed-up file was tampered with", async () => {
      createLegacyFixture();
      const migration = await migrateWorkspace(ariadneDir);

      // Tamper with backed-up GRAPH.jsonl
      const backedUpGraph = path.join(ariadneDir, "backups", migration.migrationId, "GRAPH.jsonl");
      fs.appendFileSync(backedUpGraph, "tampered line\n", "utf8");

      await expect(rollbackMigration(ariadneDir, migration.migrationId)).rejects.toThrowError(
        expect.objectContaining({ code: "CORRUPT_PERSISTED_HISTORY" }),
      );
    });

    it("resumes rollback from its durable marker after a live-file swap is interrupted", async () => {
      createLegacyFixture();
      const originalState = fs.readFileSync(path.join(ariadneDir, "STATE.yaml"), "utf8");
      const migration = await migrateWorkspace(ariadneDir, { migrationId: "MIG-rollback-interrupted" });
      const statePath = path.join(ariadneDir, "STATE.yaml");
      const originalRename = fs.promises.rename;
      const renameSpy = vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
        if (to === statePath) throw new Error("simulated rollback interruption");
        return originalRename(from, to);
      });

      try {
        await expect(rollbackMigration(ariadneDir, migration.migrationId)).rejects.toThrow(
          "simulated rollback interruption",
        );
      } finally {
        renameSpy.mockRestore();
      }

      const markerPath = path.join(ariadneDir, "migration-marker.json");
      const marker = JSON.parse(fs.readFileSync(markerPath, "utf8"));
      expect(marker.migrationId).toBe(migration.migrationId);
      expect(marker.phase).toBe("ROLLING_BACK");
      expect(marker.nextStep).toBeLessThan(marker.swapPlan.length);
      await expect(EpistemicGraph.open(ariadneDir).readEvents()).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });

      const resumed = await rollbackMigration(ariadneDir, migration.migrationId);
      expect(resumed.status).toBe("ROLLED_BACK");
      expect(await isLegacyWorkspace(ariadneDir)).toBe(true);
      expect(fs.existsSync(markerPath)).toBe(false);
      expect(fs.readFileSync(path.join(ariadneDir, "STATE.yaml"), "utf8")).toBe(originalState);
    });

    it("rolls back a forward migration that was interrupted during its swap", async () => {
      createLegacyFixture();
      const migrationId = "MIG-forward-then-rollback";
      const statePath = path.join(ariadneDir, "STATE.yaml");
      const originalRename = fs.promises.rename;
      const renameSpy = vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
        if (to === statePath) throw new Error("simulated migration interruption");
        return originalRename(from, to);
      });

      try {
        await expect(migrateWorkspace(ariadneDir, { migrationId })).rejects.toThrow(
          "simulated migration interruption",
        );
      } finally {
        renameSpy.mockRestore();
      }
      expect(JSON.parse(fs.readFileSync(path.join(ariadneDir, "migration-marker.json"), "utf8")).phase).toBe(
        "SWAPPING",
      );

      const rollback = await rollbackMigration(ariadneDir, migrationId);
      expect(rollback.status).toBe("ROLLED_BACK");
      expect(await isLegacyWorkspace(ariadneDir)).toBe(true);
      expect(fs.existsSync(path.join(ariadneDir, "migration-marker.json"))).toBe(false);
    });

    it("rejects traversal in a rollback manifest before creating its durable marker", async () => {
      createLegacyFixture();
      const migration = await migrateWorkspace(ariadneDir, { migrationId: "MIG-rollback-traversal" });
      const manifestPath = path.join(ariadneDir, "backups", migration.migrationId, "manifest.json");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const originalGraph = fs.readFileSync(path.join(ariadneDir, "GRAPH.jsonl"), "utf8");
      manifest.files["../outside.txt"] = { sha256: "0".repeat(64), sizeBytes: 0 };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

      await expect(rollbackMigration(ariadneDir, migration.migrationId)).rejects.toMatchObject({
        code: "PATH_ESCAPE",
      });
      expect(fs.existsSync(path.join(ariadneDir, "migration-marker.json"))).toBe(false);
      expect(fs.readFileSync(path.join(ariadneDir, "GRAPH.jsonl"), "utf8")).toBe(originalGraph);
    });
  });

  describe("Interruption Recovery", () => {
    it("repairs a staged manifest whose declared backup file was never copied", async () => {
      createLegacyFixture();

      const migrationId = "MIG-partial-backup-001";
      const stagingDir = path.join(ariadneDir, "staging", migrationId);
      const backupDir = path.join(ariadneDir, "backups", migrationId);
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });

      const graphDigest = await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl"));
      const manifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: { "GRAPH.jsonl": graphDigest },
        entityCounts: { nodes: 2, edges: 1, notices: 1 },
      } satisfies MigrationManifest;
      const serializedManifest = JSON.stringify(manifest, null, 2);
      fs.writeFileSync(path.join(stagingDir, "manifest.json"), serializedManifest, "utf8");
      fs.writeFileSync(path.join(backupDir, "manifest.json"), serializedManifest, "utf8");

      await migrateWorkspace(ariadneDir, { migrationId });

      const backupGraph = path.join(backupDir, "GRAPH.jsonl");
      expect(fs.existsSync(backupGraph)).toBe(true);
      expect(await computeFileDigest(backupGraph)).toEqual(graphDigest);
      expect(JSON.parse(fs.readFileSync(path.join(backupDir, "manifest.json"), "utf8")).status).toBe("COMPLETE");
    });

    it("resumes safely when an interrupted staging directory exists and source files match manifest", async () => {
      createLegacyFixture();

      const migrationId = "MIG-interrupted-001";
      const stagingDir = path.join(ariadneDir, "staging", migrationId);
      const backupDir = path.join(ariadneDir, "backups", migrationId);

      fs.mkdirSync(stagingDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });

      // Create backup files and manifest
      const sourceFiles: Record<string, { sha256: string; sizeBytes: number }> = {
        "GRAPH.jsonl": await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl")),
        "NOTICES.jsonl": await computeFileDigest(path.join(ariadneDir, "NOTICES.jsonl")),
        "STATE.yaml": await computeFileDigest(path.join(ariadneDir, "STATE.yaml")),
        "INDEX.md": await computeFileDigest(path.join(ariadneDir, "INDEX.md")),
      };

      for (const rel of Object.keys(sourceFiles)) {
        fs.copyFileSync(path.join(ariadneDir, rel), path.join(backupDir, rel));
      }

      const manifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: sourceFiles,
        entityCounts: { nodes: 2, edges: 1, notices: 1 },
      };

      fs.writeFileSync(path.join(stagingDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
      fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

      // Now run migrateWorkspace: it should detect the interrupted staging and resume
      const result = await migrateWorkspace(ariadneDir, { migrationId });

      expect(result.migrationId).toBe(migrationId);
      expect(result.dryRun).toBe(false);
      expect(await isLegacyWorkspace(ariadneDir)).toBe(false);
      expect(fs.existsSync(stagingDir)).toBe(false);
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY if source files were modified during crashed migration", async () => {
      createLegacyFixture();

      const migrationId = "MIG-interrupted-tampered";
      const stagingDir = path.join(ariadneDir, "staging", migrationId);
      const backupDir = path.join(ariadneDir, "backups", migrationId);

      fs.mkdirSync(stagingDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });

      const sourceFiles: Record<string, { sha256: string; sizeBytes: number }> = {
        "GRAPH.jsonl": await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl")),
      };

      const manifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: sourceFiles,
        entityCounts: { nodes: 2, edges: 1, notices: 1 },
      };

      fs.writeFileSync(path.join(stagingDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

      // Tamper with live GRAPH.jsonl after crash
      fs.appendFileSync(path.join(ariadneDir, "GRAPH.jsonl"), '{"kind":"node","node":{"id":"TAMPERED"}}\n', "utf8");

      // Attempting to migrate should fail closed
      await expect(migrateWorkspace(ariadneDir, { migrationId })).rejects.toThrowError(
        expect.objectContaining({ code: "CORRUPT_PERSISTED_HISTORY" }),
      );
    });
  });

  describe("Validation and Rejection Cases", () => {
    it("rejects a source symlink before creating migration artifacts", async () => {
      createLegacyFixture();
      const outside = path.join(tempDir, "outside-state.yaml");
      fs.writeFileSync(outside, JSON.stringify({ outside: true }) + "\n", "utf8");
      fs.unlinkSync(path.join(ariadneDir, "STATE.yaml"));
      fs.symlinkSync(outside, path.join(ariadneDir, "STATE.yaml"));

      await expect(migrateWorkspace(ariadneDir)).rejects.toMatchObject({ code: "PATH_ESCAPE" });
      expect(fs.existsSync(path.join(ariadneDir, "backups"))).toBe(false);
      expect(fs.existsSync(path.join(ariadneDir, "staging"))).toBe(false);
      expect(JSON.parse(fs.readFileSync(outside, "utf8"))).toEqual({ outside: true });
    });

    it("rejects a non-regular source before creating migration artifacts", async () => {
      createLegacyFixture();
      fs.rmSync(path.join(ariadneDir, "INDEX.md"));
      fs.mkdirSync(path.join(ariadneDir, "INDEX.md"));

      await expect(migrateWorkspace(ariadneDir)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(fs.existsSync(path.join(ariadneDir, "backups"))).toBe(false);
      expect(fs.existsSync(path.join(ariadneDir, "staging"))).toBe(false);
    });

    it("rejects traversal in an interrupted manifest before reading outside the workspace", async () => {
      createLegacyFixture();
      const migrationId = "MIG-malicious-manifest";
      const stagingDir = path.join(ariadneDir, "staging", migrationId);
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.writeFileSync(
        path.join(stagingDir, "manifest.json"),
        JSON.stringify({
          migrationId,
          createdAt: new Date().toISOString(),
          sourceFormat: "v0",
          targetFormat: "v1",
          status: "STAGED",
          files: { "../outside.txt": { sha256: "0".repeat(64), sizeBytes: 0 } },
          entityCounts: { nodes: 0, edges: 0, notices: 0 },
        }),
        "utf8",
      );

      await expect(migrateWorkspace(ariadneDir, { migrationId })).rejects.toMatchObject({
        code: "PATH_ESCAPE",
      });
      expect(fs.existsSync(path.join(ariadneDir, "backups", migrationId))).toBe(false);
    });

    it("rejects a tampered interrupted manifest before mutation", async () => {
      createLegacyFixture();
      const migrationId = "MIG-tampered-manifest";
      const stagingDir = path.join(ariadneDir, "staging", migrationId);
      const backupDir = path.join(ariadneDir, "backups", migrationId);
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.mkdirSync(backupDir, { recursive: true });
      const graphDigest = await computeFileDigest(path.join(ariadneDir, "GRAPH.jsonl"));
      const manifest = {
        migrationId,
        createdAt: new Date().toISOString(),
        sourceFormat: "v0",
        targetFormat: "v1",
        status: "STAGED",
        files: { "GRAPH.jsonl": { ...graphDigest, sha256: "f".repeat(64) } },
        entityCounts: { nodes: 2, edges: 1, notices: 1 },
      };
      fs.writeFileSync(path.join(stagingDir, "manifest.json"), JSON.stringify(manifest), "utf8");
      fs.writeFileSync(path.join(backupDir, "manifest.json"), JSON.stringify(manifest), "utf8");

      await expect(migrateWorkspace(ariadneDir, { migrationId })).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });
      expect(fs.existsSync(path.join(ariadneDir, "migration-marker.json"))).toBe(false);
    });

    it("recovers a simulated mid-swap interruption without leaving mixed authorities", async () => {
      createLegacyFixture();
      const migrationId = "MIG-mid-swap-recovery";
      const statePath = path.join(ariadneDir, "STATE.yaml");
      const originalRename = fs.promises.rename;
      const renameSpy = vi.spyOn(fs.promises, "rename").mockImplementation(async (from, to) => {
        if (to === statePath) throw new Error("simulated migration interruption");
        return originalRename(from, to);
      });

      try {
        await expect(migrateWorkspace(ariadneDir, { migrationId })).rejects.toThrow(
          "simulated migration interruption",
        );
      } finally {
        renameSpy.mockRestore();
      }

      expect(fs.existsSync(path.join(ariadneDir, "migration-marker.json"))).toBe(true);
      await expect(EpistemicGraph.open(ariadneDir).readEvents()).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });
      await expect(EpistemicGraph.open(ariadneDir).getState()).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });
      await expect(EpistemicGraph.open(ariadneDir).init()).rejects.toMatchObject({
        code: "CORRUPT_PERSISTED_HISTORY",
      });
      const resumed = await migrateWorkspace(ariadneDir, { migrationId });
      expect(resumed.migrationId).toBe(migrationId);
      expect(await isLegacyWorkspace(ariadneDir)).toBe(false);

      const reopened = EpistemicGraph.open(ariadneDir);
      expect((await reopened.readEvents()).length).toBe(3);
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY on corrupt JSON in GRAPH.jsonl", async () => {
      fs.writeFileSync(path.join(ariadneDir, "GRAPH.jsonl"), '{"kind":"node", invalid json\n', "utf8");

      await expect(migrateWorkspace(ariadneDir)).rejects.toThrowError(
        expect.objectContaining({ code: "CORRUPT_PERSISTED_HISTORY" }),
      );
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY on schema invalidity in GRAPH.jsonl", async () => {
      fs.writeFileSync(
        path.join(ariadneDir, "GRAPH.jsonl"),
        JSON.stringify({ kind: "node", node: { missing_id: true } }) + "\n",
        "utf8",
      );

      await expect(migrateWorkspace(ariadneDir)).rejects.toThrowError(
        expect.objectContaining({ code: "CORRUPT_PERSISTED_HISTORY" }),
      );
    });

    it("fails closed with CORRUPT_PERSISTED_HISTORY on mixed-version records in GRAPH.jsonl", async () => {
      const v0Line = JSON.stringify({
        kind: "node",
        node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "V0" },
      });
      const v1Line = JSON.stringify({
        schemaVersion: 1,
        sequence: 2,
        payloadDigest: "a".repeat(64),
        payloadLength: 10,
        crc32: 12345,
        timestamp: new Date().toISOString(),
        payload: { kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "V1" } },
      });

      fs.writeFileSync(path.join(ariadneDir, "GRAPH.jsonl"), `${v0Line}\n${v1Line}\n`, "utf8");

      await expect(migrateWorkspace(ariadneDir)).rejects.toThrowError(
        expect.objectContaining({ code: "CORRUPT_PERSISTED_HISTORY" }),
      );
    });

    it("fails closed with UNSUPPORTED_FORMAT on newer schemaVersion in GRAPH.jsonl", async () => {
      const line = JSON.stringify({
        schemaVersion: 2,
        sequence: 1,
        payload: {},
      });
      fs.writeFileSync(path.join(ariadneDir, "GRAPH.jsonl"), `${line}\n`, "utf8");

      await expect(migrateWorkspace(ariadneDir)).rejects.toThrowError(
        expect.objectContaining({ code: "UNSUPPORTED_FORMAT" }),
      );
    });
  });

  describe("CLI Integration (runCli)", () => {
    it("handles ariadne migrate --help", async () => {
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate", "--help"], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(0);
      expect(stdout.text()).toContain("Usage:\n  ariadne migrate");
      expect(stdout.text()).toContain("--dry-run");
      expect(stdout.text()).toContain("--rollback");
    });

    it("runs ariadne migrate --dry-run and ariadne migrate --dry-run --json", async () => {
      createLegacyFixture();

      // Human-readable dry-run
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate", "--dry-run"], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(0);
      expect(stdout.text()).toContain("Migration Dry Run Summary:");
      expect(stdout.text()).toContain("Nodes: 2");
      expect(stdout.text()).toContain("Edges: 1");
      expect(stdout.text()).toContain("No files were written to disk.");

      // JSON dry-run
      const stdoutJson = capture();
      const stderrJson = capture();
      const codeJson = await runCli(["migrate", "--dry-run", "--json"], {
        cwd: tempDir,
        stdout: stdoutJson.stream,
        stderr: stderrJson.stream,
      });

      expect(codeJson).toBe(0);
      const parsedJson = JSON.parse(stdoutJson.text());
      expect(parsedJson.dryRun).toBe(true);
      expect(parsedJson.entityCounts.nodes).toBe(2);
      expect(parsedJson.entityCounts.edges).toBe(1);
    });

    it("runs ariadne migrate and then ariadne migrate --rollback <id>", async () => {
      createLegacyFixture();

      // 1. Run migration
      const stdoutMigrate = capture();
      const stderrMigrate = capture();
      const codeMigrate = await runCli(["migrate"], {
        cwd: tempDir,
        stdout: stdoutMigrate.stream,
        stderr: stderrMigrate.stream,
      });

      expect(codeMigrate).toBe(0);
      expect(stdoutMigrate.text()).toContain("Migration Completed Successfully!");
      expect(stdoutMigrate.text()).toContain("Format: v0 -> v1");
      expect(stdoutMigrate.text()).toContain("Nodes Migrated: 2");
      expect(await isLegacyWorkspace(ariadneDir)).toBe(false);

      // Extract migrationId from stdout
      const idMatch = stdoutMigrate.text().match(/Migration ID:\s+(MIG-[^\s]+)/);
      expect(idMatch).not.toBeNull();
      const migrationId = idMatch![1];

      // 2. Run rollback
      const stdoutRollback = capture();
      const stderrRollback = capture();
      const codeRollback = await runCli(["migrate", "--rollback", migrationId], {
        cwd: tempDir,
        stdout: stdoutRollback.stream,
        stderr: stderrRollback.stream,
      });

      expect(codeRollback).toBe(0);
      expect(stdoutRollback.text()).toContain("Rollback Completed Successfully!");
      expect(stdoutRollback.text()).toContain("Workspace has been restored to its original v0 state.");
      expect(await isLegacyWorkspace(ariadneDir)).toBe(true);
    });

    it("fails closed on invalid rollback invocation without id", async () => {
      createLegacyFixture();

      const stdout = capture();
      const stderr = capture();
      const code = await runCli(["migrate", "--rollback"], {
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
      });

      expect(code).toBe(2);
      expect(stderr.text()).toContain("INVALID_INPUT");
    });
  });
});
