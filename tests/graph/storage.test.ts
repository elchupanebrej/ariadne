import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GraphStorage } from "../../src/graph/storage.js";

describe("GraphStorage", () => {
  it("validates state-owned fields while preserving overlay extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-storage-state-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.writeState({
        mode: "gsd",
        depth_mode: "Deep",
        frontier: ["CAN-1"],
        gsd_extension: { phase: "01" },
      });
      await expect(storage.readState()).resolves.toMatchObject({
        gsd_extension: { phase: "01" },
      });
      await expect(storage.writeState({ depth_mode: "invalid" })).rejects.toThrow(
        /STATE/i,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
