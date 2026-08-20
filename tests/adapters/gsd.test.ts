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
});
