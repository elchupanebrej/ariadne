import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { EpistemicGraph } from "../../src/graph/epistemic-graph.js";
import { GraphStorage } from "../../src/graph/storage.js";
import { readFramedRecords, verifyFrame } from "../../src/graph/journal.js";
import { emitGsdOperationalNotice } from "../../src/adapters/gsd/operational-notice.js";

describe("hardened persistence active path", () => {
  it("routes public filesystem graph mutations through framed canonical records", async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-active-path-"));

    try {
      const graph = EpistemicGraph.open(storageRoot);
      await graph.addNode("ASM", "ASM-active", "Active persistence", {
        provenance_type: "ASSUMED",
        statement: "The public graph mutation uses the hardened persistence path",
      });

      const records = await readFramedRecords(path.join(storageRoot, "GRAPH.jsonl"));
      expect(records).toHaveLength(1);
      expect(verifyFrame(JSON.stringify(records[0]))).toBe(true);
      expect(records[0].payload).toMatchObject({
        kind: "node",
        node: { id: "ASM-active" },
      });
      expect(fs.existsSync(path.join(storageRoot, "GRAPH.jsonl.lock"))).toBe(false);
      expect(fs.existsSync(path.join(storageRoot, ".lock"))).toBe(false);
    } finally {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("rejects legacy workspaces through the public library mutation seam", async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-active-legacy-"));

    try {
      fs.writeFileSync(
        path.join(storageRoot, "GRAPH.jsonl"),
        `${JSON.stringify({
          kind: "node",
          node: {
            id: "ASM-legacy",
            type: "ASM",
            provenance_type: "ASSUMED",
            statement: "Legacy record",
          },
        })}\n`,
        "utf8",
      );
      const before = fs.readFileSync(path.join(storageRoot, "GRAPH.jsonl"), "utf8");

      await expect(
        EpistemicGraph.open(storageRoot).addNode("ASM", "ASM-new", "New node", {
          provenance_type: "ASSUMED",
          statement: "Must not be written",
        }),
      ).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });

      expect(fs.readFileSync(path.join(storageRoot, "GRAPH.jsonl"), "utf8")).toBe(before);
      expect(fs.existsSync(path.join(storageRoot, ".lock"))).toBe(false);
    } finally {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("rejects mixed graph and notice authorities before any append", async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-active-mixed-authorities-"));

    try {
      const graph = EpistemicGraph.open(storageRoot);
      await graph.addNode("ASM", "ASM-framed", "Framed graph authority", {
        provenance_type: "ASSUMED",
        statement: "The graph authority is already canonical",
      });
      fs.writeFileSync(
        path.join(storageRoot, "NOTICES.jsonl"),
        `${JSON.stringify({
          kind: "operational_notice",
          id: "NOT-legacy",
          falsified_id: "ASM-framed",
          evidence_id: "EVD-legacy",
          affected_ids: ["ASM-framed"],
          reason: "Legacy notice",
          message: "Legacy notice",
          owner: "Ariadne",
          next_action: "Migrate",
          revaluation_condition: "After migration",
          created_at: "2026-09-08T00:00:00.000Z",
        })}\n`,
        "utf8",
      );
      const before = fs.readFileSync(path.join(storageRoot, "GRAPH.jsonl"), "utf8");

      await expect(
        graph.addNode("ASM", "ASM-rejected", "Mixed authority mutation", {
          provenance_type: "ASSUMED",
          statement: "Must not be written",
        }),
      ).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });

      expect(fs.readFileSync(path.join(storageRoot, "GRAPH.jsonl"), "utf8")).toBe(before);
    } finally {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("uses framed canonical records for GraphStorage mutations as well", async () => {
    const storageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-storage-active-"));

    try {
      const storage = new GraphStorage(storageRoot);
      await storage.appendNode({
        id: "TASK-active",
        type: "TASK",
        provenance_type: "FACT",
        statement: "GraphStorage shares the hardened path",
      });

      const records = await readFramedRecords(path.join(storageRoot, "GRAPH.jsonl"));
      expect(records).toHaveLength(1);
      expect(records[0].payload).toMatchObject({ kind: "node", node: { id: "TASK-active" } });
    } finally {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("routes operational notice mutations through the framed notice authority", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-notice-active-"));
    try {
      fs.mkdirSync(path.join(root, ".planning"), { recursive: true });
      await emitGsdOperationalNotice(root, {
        falsifiedId: "ASM-active",
        evidenceId: "EVD-active",
        affectedIds: ["CAN-active"],
      }, { writer: () => undefined });

      const noticesPath = path.join(root, ".planning", "ariadne", "NOTICES.jsonl");
      const records = await readFramedRecords(noticesPath);
      expect(records).toHaveLength(1);
      expect(records[0].payload).toMatchObject({
        kind: "operational_notice",
        id: "NOT-001",
      });
      expect(fs.existsSync(path.join(root, ".planning", "ariadne", "NOTICES.jsonl.lock"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
