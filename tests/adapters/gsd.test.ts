import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertNoShadowState,
  detectGsd,
  findZeroShadowFiles,
  resolveAriadneStorageRoot,
} from "../../src/adapters/gsd/detector.js";
import {
  assertDecisionReopenAllowed,
  projectGsd,
} from "../../src/adapters/gsd/projector.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";

describe("GSD detector and zero-shadow state", () => {
  it("detects a .planning directory and selects its Ariadne overlay", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-gsd-"));
    try {
      await mkdir(join(root, ".planning"));

      const environment = detectGsd(root);

      expect(environment.active).toBe(true);
      expect(environment.planningPath).toBe(join(root, ".planning"));
      expect(environment.overlayPath).toBe(join(root, ".planning", "ariadne"));
      expect(resolveAriadneStorageRoot(root)).toBe(join(root, ".planning", "ariadne"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports an explicit override when .planning is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-standalone-"));
    try {
      expect(detectGsd(root).active).toBe(false);
      expect(detectGsd(root, { override: true }).active).toBe(true);
      expect(resolveAriadneStorageRoot(root)).toBe(join(root, ".ariadne"));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects Ariadne-owned shadow files while GSD is active", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-shadow-"));
    try {
      const planning = join(root, ".planning");
      const overlay = join(planning, "ariadne");
      await mkdir(overlay, { recursive: true });
      await writeFile(join(overlay, "PROJECT.md"), "shadow");

      expect(findZeroShadowFiles(root)).toEqual([join(overlay, "PROJECT.md")]);
      expect(() => assertNoShadowState(root)).toThrow(/shadow/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not enforce GSD shadow rules in standalone mode", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-standalone-"));
    try {
      await writeFile(join(root, "PROJECT.md"), "standalone project");
      expect(findZeroShadowFiles(root)).toEqual([]);
      expect(() => assertNoShadowState(root)).not.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("projects GSD documents and locked decisions into valid DECIDED nodes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-gsd-project-"));
    try {
      const planning = join(root, ".planning");
      await mkdir(join(planning, "phases", "01-foundation"), { recursive: true });
      await writeFile(join(planning, "PROJECT.md"), "# Project\nA durable graph.");
      await writeFile(join(planning, "REQUIREMENTS.md"), "# Requirements\n- R-001: Keep state atomic.");
      await writeFile(join(planning, "ROADMAP.md"), "# Roadmap\n## Phase 1: Foundation\nBuild the graph.");
      await writeFile(
        join(planning, "phases", "01-foundation", "CONTEXT.md"),
        [
          "# Phase Context",
          "",
          "## Decisions",
          "- D-001: Use append-only graph events via CAN-001, supported by EVD-001.",
          "- D-002 — Keep GSD operational files canonical.",
          "",
          "## Claude's Discretion",
          "- Choose test fixtures.",
        ].join("\n"),
      );

      const projection = await projectGsd(root);
      const decisions = projection.nodes.filter((node) => node.type === "DEC");

      expect(projection.documents.project).toContain("A durable graph");
      expect(projection.documents.requirements).toContain("R-001");
      expect(projection.documents.roadmap).toContain("Phase 1");
      expect(decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "DEC-D-001",
            provenance_type: "DECIDED",
            external_ref: "gsd:D-001",
            selected_candidate_ref: "CAN-001",
            source_evidence: expect.objectContaining({
              source_path: expect.stringContaining("CONTEXT.md"),
              evidence_refs: ["EVD-001"],
            }),
            unresolved_risk: "UNRESOLVED",
          }),
          expect.objectContaining({
            id: "DEC-D-002",
            provenance_type: "DECIDED",
            external_ref: "gsd:D-002",
          }),
        ]),
      );
      expect(decisions.every((node) => NodeSchema.safeParse(node).success)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects reopening a locked decision without human instruction or falsifying evidence", () => {
    expect(() => assertDecisionReopenAllowed("D-001")).toThrow(/human|falsifying/i);
    expect(() =>
      assertDecisionReopenAllowed("D-001", { humanInstruction: "The architect changed scope." }),
    ).not.toThrow();
    expect(() =>
      assertDecisionReopenAllowed("D-001", { falsifyingEvidence: { falsifies: true } }),
    ).not.toThrow();
  });
});
