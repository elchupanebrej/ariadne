import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Writable } from "node:stream";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  scanAndRecoverJournal,
  rebuildProjections,
  isLegacyWorkspace,
  assertNotLegacyWorkspace,
  createFrame,
  appendCanonicalRecord,
  type FramedRecord,
} from "../../src/graph/index.js";
import { AriadneError } from "../../src/core/errors.js";
import { runCli } from "../../src/cli/index.js";

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

describe("Crash Recovery and Legacy Workspace Mutation Gate", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-recovery-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Startup Integrity Scan & Tail Recovery (scanAndRecoverJournal)", () => {
    it("handles non-existent or empty journal files gracefully", async () => {
      const nonExistent = path.join(tempDir, "GRAPH.jsonl");
      const res1 = await scanAndRecoverJournal(nonExistent);
      expect(res1.validRecords).toBe(0);
      expect(res1.recoveredTail).toBe(false);
      expect(res1.truncatedBytes).toBe(0);
      expect(res1.lastSequence).toBe(0);
      expect(res1.records).toEqual([]);

      const emptyFile = path.join(tempDir, "NOTICES.jsonl");
      fs.writeFileSync(emptyFile, "", "utf8");
      const res2 = await scanAndRecoverJournal(emptyFile);
      expect(res2.validRecords).toBe(0);
      expect(res2.recoveredTail).toBe(false);
      expect(res2.records).toEqual([]);
    });

    it("performs clean startup on valid journal", async () => {
      const journalPath = path.join(tempDir, "GRAPH.jsonl");

      const frame1 = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Test 1" } }, { sequence: 1 });
      const frame2 = createFrame({ kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Test 2" } }, { sequence: 2 });
      const frame3 = createFrame({ kind: "edge", edge: { source: "HYP-1", type: "supports", target: "HYP-2" } }, { sequence: 3 });

      await appendCanonicalRecord(journalPath, frame1);
      await appendCanonicalRecord(journalPath, frame2);
      await appendCanonicalRecord(journalPath, frame3);

      const sizeBefore = fs.statSync(journalPath).size;
      const scan = await scanAndRecoverJournal(journalPath);

      expect(scan.validRecords).toBe(3);
      expect(scan.recoveredTail).toBe(false);
      expect(scan.truncatedBytes).toBe(0);
      expect(scan.lastSequence).toBe(3);
      expect(scan.diagnostic).toBeUndefined();
      expect(scan.records.length).toBe(3);
      expect(fs.statSync(journalPath).size).toBe(sizeBefore);
    });

    it("safely truncates incomplete final frame (torn write without newline) and emits INCOMPLETE_TAIL", async () => {
      const journalPath = path.join(tempDir, "GRAPH.jsonl");

      const frame1 = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "First valid" } }, { sequence: 1 });
      const frame2 = createFrame({ kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Second valid" } }, { sequence: 2 });

      await appendCanonicalRecord(journalPath, frame1);
      await appendCanonicalRecord(journalPath, frame2);

      const verifiedSize = fs.statSync(journalPath).size;

      // Simulate a process crash mid-write: write partial bytes of frame 3 with no trailing newline
      const tornWrite = '{"schemaVersion":1,"sequence":3,"payloadDigest":"abcd';
      fs.appendFileSync(journalPath, tornWrite, "utf8");

      expect(fs.statSync(journalPath).size).toBe(verifiedSize + Buffer.byteLength(tornWrite, "utf8"));

      // Run integrity scan
      const scan = await scanAndRecoverJournal(journalPath);

      expect(scan.recoveredTail).toBe(true);
      expect(scan.truncatedBytes).toBe(Buffer.byteLength(tornWrite, "utf8"));
      expect(scan.validRecords).toBe(2);
      expect(scan.lastSequence).toBe(2);
      expect(scan.diagnostic).toBeDefined();
      expect(scan.diagnostic?.code).toBe("INCOMPLETE_TAIL");
      expect(scan.records.length).toBe(2);

      // Verify file was truncated back to last valid frame offset
      expect(fs.statSync(journalPath).size).toBe(verifiedSize);

      // Re-running scan now finds clean journal
      const secondScan = await scanAndRecoverJournal(journalPath);
      expect(secondScan.recoveredTail).toBe(false);
      expect(secondScan.validRecords).toBe(2);
      expect(secondScan.truncatedBytes).toBe(0);
    });

    it("safely truncates corrupted final frame with newline and invalid checksum", async () => {
      const journalPath = path.join(tempDir, "GRAPH.jsonl");

      const frame1 = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "First valid" } }, { sequence: 1 });
      await appendCanonicalRecord(journalPath, frame1);
      const verifiedSize = fs.statSync(journalPath).size;

      // Append final frame with corrupt CRC32 and payloadDigest
      const corruptFinalFrame = JSON.stringify({
        schemaVersion: 1,
        sequence: 2,
        payloadDigest: "0".repeat(64),
        payloadLength: 10,
        crc32: 999999,
        timestamp: new Date().toISOString(),
        payload: { invalid: true },
      }) + "\n";

      fs.appendFileSync(journalPath, corruptFinalFrame, "utf8");

      const scan = await scanAndRecoverJournal(journalPath);
      expect(scan.recoveredTail).toBe(true);
      expect(scan.truncatedBytes).toBe(Buffer.byteLength(corruptFinalFrame, "utf8"));
      expect(scan.validRecords).toBe(1);
      expect(scan.diagnostic?.code).toBe("INCOMPLETE_TAIL");
      expect(fs.statSync(journalPath).size).toBe(verifiedSize);
    });

    it("fails closed immediately with CORRUPT_PERSISTED_HISTORY on middle-log corruption and strictly does not truncate", async () => {
      const journalPath = path.join(tempDir, "GRAPH.jsonl");

      const frame1 = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } }, { sequence: 1 });
      const frame3 = createFrame({ kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 3" } }, { sequence: 3 });

      // Corrupt middle frame (tampered CRC)
      const corruptMiddle = JSON.stringify({
        schemaVersion: 1,
        sequence: 2,
        payloadDigest: "e".repeat(64),
        payloadLength: 50,
        crc32: 42,
        timestamp: new Date().toISOString(),
        payload: { kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Corrupted" } },
      }) + "\n";

      await appendCanonicalRecord(journalPath, frame1);
      fs.appendFileSync(journalPath, corruptMiddle, "utf8");
      await appendCanonicalRecord(journalPath, frame3);

      const totalSizeBefore = fs.statSync(journalPath).size;

      let caughtError: unknown;
      try {
        await scanAndRecoverJournal(journalPath);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AriadneError);
      const ariadneError = caughtError as AriadneError;
      expect(ariadneError.code).toBe("CORRUPT_PERSISTED_HISTORY");
      expect(ariadneError.message).toContain("Middle corruption or checksum mismatch detected in canonical history");
      expect(ariadneError.repair).toContain("Inspect");

      // Verify automatic truncation was strictly prohibited
      expect(fs.statSync(journalPath).size).toBe(totalSizeBefore);
    });

    it("fails closed on middle sequence break and strictly does not truncate", async () => {
      const journalPath = path.join(tempDir, "GRAPH.jsonl");

      const frame1 = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 1" } }, { sequence: 1 });
      const frame2Gapped = createFrame({ kind: "node", node: { id: "HYP-2", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 2" } }, { sequence: 5 }); // sequence gap
      const frame3 = createFrame({ kind: "node", node: { id: "HYP-3", type: "HYP", provenance_type: "PROPOSED", statement: "Valid 3" } }, { sequence: 6 });

      await appendCanonicalRecord(journalPath, frame1);
      await appendCanonicalRecord(journalPath, frame2Gapped);
      await appendCanonicalRecord(journalPath, frame3);

      const sizeBefore = fs.statSync(journalPath).size;

      let caughtError: unknown;
      try {
        await scanAndRecoverJournal(journalPath);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(AriadneError);
      expect((caughtError as AriadneError).code).toBe("CORRUPT_PERSISTED_HISTORY");
      expect(fs.statSync(journalPath).size).toBe(sizeBefore);
    });
  });

  describe("Projection Repair Engine (rebuildProjections)", () => {
    it("reconstructs STATE.yaml, INDEX.md, and all cards/*.md faithfully from canonical records", async () => {
      const storageRoot = tempDir;
      const graphPath = path.join(storageRoot, "GRAPH.jsonl");

      const node1 = {
        id: "HYP-1",
        type: "HYP",
        provenance_type: "PROPOSED",
        status: "ACTIVE",
        statement: "Primary hypothesis under evaluation",
      };
      const node2 = {
        id: "UNK-1",
        type: "UNK",
        provenance_type: "UNKNOWN",
        status: "ACTIVE",
        statement: "Unknown latency profile under burst load",
      };
      const node3 = {
        id: "DEC-1",
        type: "DEC",
        provenance_type: "DECIDED",
        status: "DECIDED",
        statement: "Adopt single root lock persistence model",
      };
      const edge1 = {
        source: "HYP-1",
        type: "depends_on",
        target: "UNK-1",
      };

      await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node: node1 }, { sequence: 1 }));
      await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node: node2 }, { sequence: 2 }));
      await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node: node3 }, { sequence: 3 }));
      await appendCanonicalRecord(graphPath, createFrame({ kind: "edge", edge: edge1 }, { sequence: 4 }));

      // Create corrupted/empty projection files and an orphaned card
      const statePath = path.join(storageRoot, "STATE.yaml");
      const indexPath = path.join(storageRoot, "INDEX.md");
      const cardsDir = path.join(storageRoot, "cards");
      fs.mkdirSync(cardsDir, { recursive: true });

      fs.writeFileSync(statePath, "{ broken json: corrupt", "utf8");
      fs.writeFileSync(indexPath, "Corrupted index", "utf8");
      fs.writeFileSync(path.join(cardsDir, "ORPHAN-OLD.md"), "Old orphan card", "utf8");

      // Run rebuildProjections
      await rebuildProjections(storageRoot);

      // Verify INDEX.md
      expect(fs.existsSync(indexPath)).toBe(true);
      const indexContent = fs.readFileSync(indexPath, "utf8");
      expect(indexContent).toContain("# Ariadne Epistemic Index");
      expect(indexContent).toContain("Nodes: 3 · Edges: 1");
      expect(indexContent).toContain("HYP-1");
      expect(indexContent).toContain("UNK-1");

      // Verify cards/*.md
      expect(fs.existsSync(path.join(cardsDir, "HYP-1.md"))).toBe(true);
      expect(fs.readFileSync(path.join(cardsDir, "HYP-1.md"), "utf8")).toContain("# HYP-1");
      expect(fs.existsSync(path.join(cardsDir, "UNK-1.md"))).toBe(true);
      expect(fs.readFileSync(path.join(cardsDir, "UNK-1.md"), "utf8")).toContain("# UNK-1");
      expect(fs.existsSync(path.join(cardsDir, "DEC-1.md"))).toBe(true);
      expect(fs.readFileSync(path.join(cardsDir, "DEC-1.md"), "utf8")).toContain("# DEC-1");

      // Verify orphaned card was cleaned up
      expect(fs.existsSync(path.join(cardsDir, "ORPHAN-OLD.md"))).toBe(false);

      // Verify STATE.yaml
      expect(fs.existsSync(statePath)).toBe(true);
      const stateContent = fs.readFileSync(statePath, "utf8");
      const parsedState = JSON.parse(stateContent);
      expect(parsedState.schema_version).toBe(1);
      expect(parsedState.frontier).toContain("HYP-1");
      expect(parsedState.frontier).toContain("UNK-1");
      expect(parsedState.frontier).not.toContain("DEC-1"); // DEC-1 is terminal
      expect(parsedState.open_unknowns).toEqual(["UNK-1"]);
    });

    it("preserves custom adapter overlay attributes in STATE.yaml across reconstruction", async () => {
      const storageRoot = tempDir;
      const graphPath = path.join(storageRoot, "GRAPH.jsonl");

      const node1 = {
        id: "HYP-1",
        type: "HYP",
        provenance_type: "PROPOSED",
        status: "ACTIVE",
        statement: "Hypothesis with custom overlay",
      };
      await appendCanonicalRecord(graphPath, createFrame({ kind: "node", node: node1 }, { sequence: 1 }));

      const statePath = path.join(storageRoot, "STATE.yaml");
      const initialOverlay = {
        mode: "gsd",
        depth_mode: "Deep",
        custom_adapter_field: "preserved-fact",
      };
      fs.writeFileSync(statePath, JSON.stringify(initialOverlay, null, 2), "utf8");

      await rebuildProjections(storageRoot);

      const reconstructed = JSON.parse(fs.readFileSync(statePath, "utf8"));
      expect(reconstructed.mode).toBe("gsd");
      expect(reconstructed.depth_mode).toBe("Deep");
      expect(reconstructed.custom_adapter_field).toBe("preserved-fact");
      expect(reconstructed.frontier).toEqual(["HYP-1"]);
      expect(reconstructed.schema_version).toBe(1);
    });
  });

  describe("Legacy Workspace Protection Gate (isLegacyWorkspace & assertNotLegacyWorkspace)", () => {
    it("classifies empty or fresh workspaces as non-legacy", async () => {
      expect(await isLegacyWorkspace(tempDir)).toBe(false);
      await expect(assertNotLegacyWorkspace(tempDir)).resolves.toBeUndefined();

      const nonExistent = path.join(tempDir, "does-not-exist");
      expect(await isLegacyWorkspace(nonExistent)).toBe(false);
      await expect(assertNotLegacyWorkspace(nonExistent)).resolves.toBeUndefined();
    });

    it("detects legacy v0 workspace with unversioned/naked records in GRAPH.jsonl", async () => {
      const graphPath = path.join(tempDir, "GRAPH.jsonl");
      // Legacy v0 unversioned naked records (missing schemaVersion: 1 envelope)
      const v0Line1 = JSON.stringify({
        kind: "node",
        node: {
          id: "HYP-1",
          type: "HYP",
          provenance_type: "PROPOSED",
          statement: "Unversioned legacy node",
        },
      }) + "\n";
      fs.writeFileSync(graphPath, v0Line1, "utf8");

      expect(await isLegacyWorkspace(tempDir)).toBe(true);

      let caught: unknown;
      try {
        await assertNotLegacyWorkspace(tempDir);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(AriadneError);
      const aError = caught as AriadneError;
      expect(aError.code).toBe("MIGRATION_REQUIRED");
      expect(aError.message).toBe("Legacy (v0) workspace detected; mutation prohibited until migration.");
      expect(aError.repair).toBe("Run 'ariadne migrate' to upgrade the workspace format.");
    });

    it("detects V1 workspace with framed records as non-legacy", async () => {
      const graphPath = path.join(tempDir, "GRAPH.jsonl");
      const frame = createFrame({ kind: "node", node: { id: "HYP-1", type: "HYP", provenance_type: "PROPOSED", statement: "V1 frame" } }, { sequence: 1 });
      await appendCanonicalRecord(graphPath, frame);

      expect(await isLegacyWorkspace(tempDir)).toBe(false);
      await expect(assertNotLegacyWorkspace(tempDir)).resolves.toBeUndefined();
    });
  });

  describe("CLI Integration on Legacy Workspaces", () => {
    let legacyCwd: string;
    let initialGraphContent: string;
    let initialGraphSize: number;

    beforeEach(() => {
      legacyCwd = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-cli-legacy-"));
      const ariadneDir = path.join(legacyCwd, ".ariadne");
      fs.mkdirSync(ariadneDir, { recursive: true });

      const node1 = {
        kind: "node",
        node: {
          id: "HYP-1",
          type: "HYP",
          provenance_type: "PROPOSED",
          status: "ACTIVE",
          statement: "Legacy hypothesis 1",
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
        },
      };

      initialGraphContent = `${JSON.stringify(node1)}\n${JSON.stringify(node2)}\n`;
      fs.writeFileSync(path.join(ariadneDir, "GRAPH.jsonl"), initialGraphContent, "utf8");
      fs.writeFileSync(
        path.join(ariadneDir, "STATE.yaml"),
        JSON.stringify({ frontier: ["HYP-1", "UNK-1"], open_unknowns: ["UNK-1"] }, null, 2) + "\n",
        "utf8",
      );
      initialGraphSize = fs.statSync(path.join(ariadneDir, "GRAPH.jsonl")).size;
    });

    afterEach(() => {
      fs.rmSync(legacyCwd, { recursive: true, force: true });
    });

    it("permits read-only inspection operations (status, report, viz) on legacy workspaces", async () => {
      // 1. ariadne status
      const stdoutStatus = capture();
      const stderrStatus = capture();
      const codeStatus = await runCli(["status"], {
        cwd: legacyCwd,
        stdout: stdoutStatus.stream,
        stderr: stderrStatus.stream,
      });
      expect(codeStatus).toBe(0);
      expect(stdoutStatus.text()).toContain("Ariadne status");
      expect(stdoutStatus.text()).toContain("HYP-1");

      // 2. ariadne report
      const stdoutReport = capture();
      const stderrReport = capture();
      const codeReport = await runCli(["report"], {
        cwd: legacyCwd,
        stdout: stdoutReport.stream,
        stderr: stderrReport.stream,
      });
      expect(codeReport).toBe(0);
      expect(stdoutReport.text()).toContain("ARIADNE DECISION-TREE REPORT");

      // 3. ariadne viz
      const stdoutViz = capture();
      const stderrViz = capture();
      const codeViz = await runCli(["viz"], {
        cwd: legacyCwd,
        stdout: stdoutViz.stream,
        stderr: stderrViz.stream,
      });
      expect(codeViz).toBe(0);
      expect(stdoutViz.text()).toContain("wrote .ariadne/reports/");
      const htmlRelPath = stdoutViz.text().trim().replace(/^wrote\s+/, "");
      const htmlContent = fs.readFileSync(path.join(legacyCwd, htmlRelPath), "utf8");
      expect(htmlContent).toContain("HYP-1");

      // Verify files untouched
      const currentGraph = fs.readFileSync(path.join(legacyCwd, ".ariadne", "GRAPH.jsonl"), "utf8");
      expect(currentGraph).toBe(initialGraphContent);
    });

    it("gates 'ariadne node' mutating operations to fail closed with exit code 2 and AriadneError(MIGRATION_REQUIRED)", async () => {
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(
        [
          "node",
          "add",
          "HYP",
          "HYP-NEW",
          "--title",
          "New Candidate",
          "--payload",
          JSON.stringify({ statement: "Testing mutation gate", provenance_type: "PROPOSED" }),
        ],
        { cwd: legacyCwd, stdout: stdout.stream, stderr: stderr.stream },
      );

      expect(code).toBe(2);
      expect(stderr.text()).toContain("MIGRATION_REQUIRED");
      expect(stderr.text()).toContain("Legacy (v0) workspace detected; mutation prohibited until migration.");
      expect(stderr.text()).toContain("Run 'ariadne migrate' to upgrade the workspace format.");

      // Verify files in .ariadne were NOT modified
      const currentSize = fs.statSync(path.join(legacyCwd, ".ariadne", "GRAPH.jsonl")).size;
      expect(currentSize).toBe(initialGraphSize);
    });

    it("gates 'ariadne edge' mutating operations to fail closed with exit code 2 and AriadneError(MIGRATION_REQUIRED)", async () => {
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(
        ["edge", "add", "HYP-1", "depends_on", "UNK-1"],
        { cwd: legacyCwd, stdout: stdout.stream, stderr: stderr.stream },
      );

      expect(code).toBe(2);
      expect(stderr.text()).toContain("MIGRATION_REQUIRED");
      expect(fs.statSync(path.join(legacyCwd, ".ariadne", "GRAPH.jsonl")).size).toBe(initialGraphSize);
    });

    it("gates 'ariadne invalidate' mutating operations to fail closed with exit code 2 and AriadneError(MIGRATION_REQUIRED)", async () => {
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(
        ["invalidate", "HYP-1", "--by", "EVI-1"],
        { cwd: legacyCwd, stdout: stdout.stream, stderr: stderr.stream },
      );

      expect(code).toBe(2);
      expect(stderr.text()).toContain("MIGRATION_REQUIRED");
      expect(fs.statSync(path.join(legacyCwd, ".ariadne", "GRAPH.jsonl")).size).toBe(initialGraphSize);
    });

    it("gates 'ariadne gate' operations to fail closed with exit code 2 and AriadneError(MIGRATION_REQUIRED)", async () => {
      const stdout = capture();
      const stderr = capture();
      const code = await runCli(
        ["gate", "all"],
        { cwd: legacyCwd, stdout: stdout.stream, stderr: stderr.stream },
      );

      expect(code).toBe(2);
      expect(stderr.text()).toContain("MIGRATION_REQUIRED");
      expect(fs.statSync(path.join(legacyCwd, ".ariadne", "GRAPH.jsonl")).size).toBe(initialGraphSize);
    });
  });
});
