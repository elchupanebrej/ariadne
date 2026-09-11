import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AriadneHarnessController } from "../../src/harness/controller.js";
import { NodeSchema } from "../../src/core/schemas/nodes.js";

const setupGsd = async (root: string): Promise<void> => {
  await mkdir(join(root, ".planning"), { recursive: true });
  await writeFile(join(root, ".planning", "PROJECT.md"), "# Project\nAriadne integration.");
  await writeFile(join(root, ".planning", "REQUIREMENTS.md"), "# Requirements\n- R-001");
  await writeFile(join(root, ".planning", "ROADMAP.md"), "# Roadmap\n## Phase 1");
  await mkdir(join(root, ".planning", "phases", "01-foundation"), { recursive: true });
  await writeFile(
    join(root, ".planning", "phases", "01-foundation", "CONTEXT.md"),
    "## Decisions\n- D-001: Keep the graph typed.\n",
  );
};

const setupMattMarker = async (root: string): Promise<void> => {
  await mkdir(join(root, ".agents", "skills", "diagnosing-bugs"), { recursive: true });
  await writeFile(join(root, ".agents", "skills", "diagnosing-bugs", "SKILL.md"), "# Matt skill");
};

describe("ecosystem modes A, B, and C", () => {
  it("Mode A projects GSD decisions and persists Matt evidence in the overlay", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-mode-a-"));
    try {
      await setupGsd(root);
      await setupMattMarker(root);
      const controller = new AriadneHarnessController({ rootDirectory: root });

      expect(controller.storageRoot).toBe(join(root, ".planning", "ariadne"));

      const projection = await controller.projectGsd();
      expect(projection.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            external_ref: "gsd:D-001",
            provenance_type: "DECIDED",
          }),
        ]),
      );
      const projectedDecision = (await controller.readGraph()).nodes.find(
        (node) => node.id === "DEC-D-001",
      );
      expect(projectedDecision).toBeDefined();
      await controller.persistNode({
        ...projectedDecision,
        status: "RE-OPENED",
        invalidation: {
          evidence_id: "EVD-REOPEN-1",
          previous_status: "LOCKED",
          status: "RE-OPENED",
          needs_review: true,
        },
      });
      const beforeReprojection = await controller.graph.readEvents();
      const reprojected = await controller.projectGsd();
      const persistedDecision = (await controller.readGraph()).nodes.find(
        (node) => node.id === "DEC-D-001",
      );
      expect(reprojected.decisions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "DEC-D-001", status: "RE-OPENED" }),
        ]),
      );
      expect(persistedDecision).toMatchObject({
        id: "DEC-D-001",
        status: "RE-OPENED",
        invalidation: expect.objectContaining({ needs_review: true }),
      });
      expect(await controller.graph.readEvents()).toHaveLength(beforeReprojection.length);
      const firstEvents = await controller.graph.readEvents();
      expect(await controller.readGraph()).toEqual(
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "STATE-GSD-STATE", type: "STATE" }),
            expect.objectContaining({ id: "TASK-GSD-ROADMAP", type: "TASK" }),
          ]),
        }),
      );
      await controller.projectGsd();
      expect(await controller.graph.readEvents()).toHaveLength(firstEvents.length);
      expect(await controller.graph.getState()).toEqual(
        expect.objectContaining({ mode: "gsd", gsd_projection: expect.any(Object) }),
      );

      const evidence = await controller.ingestMattArtifact("diagnosing-bugs", {
        statement: "The red-capable test passed.",
        red_capable: true,
        executed: true,
        verdict: "SUPPORTED",
        method: "vitest",
        rung: 3,
        test_command: "npm test -- focused",
        stdout_digest: "sha256:mode-a",
        reproducible_environment: "node-22/linux-x64",
        result: "passed",
      });
      expect(evidence.type).toBe("EVD");
      expect(NodeSchema.safeParse(evidence).success).toBe(true);

      const graph = await controller.readGraph();
      expect(graph.nodes).toEqual(expect.arrayContaining([expect.objectContaining({ type: "EVD" })]));
      expect(await readFile(join(root, ".planning", "ariadne", "GRAPH.jsonl"), "utf8")).toContain(
        "EVD",
      );
      expect(existsSync(join(root, ".planning", "ariadne", "PROJECT.md"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("Mode B projects GSD when Matt is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-mode-b-"));
    try {
      await setupGsd(root);
      const controller = new AriadneHarnessController({ rootDirectory: root });

      await expect(controller.projectGsd()).resolves.toMatchObject({
        decisions: expect.any(Array),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("Mode C uses the standalone file controller with Matt ingestion", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-mode-c-"));
    try {
      await setupMattMarker(root);
      const controller = new AriadneHarnessController({ rootDirectory: root });

      expect(controller.storageRoot).toBe(join(root, ".ariadne"));

      const evidence = await controller.ingestMattArtifact("research", {
        statement: "A primary source was reviewed.",
      });
      expect(evidence.type).toBe("EVDREQ");
      expect(await controller.readGraph()).toMatchObject({
        nodes: [expect.objectContaining({ id: evidence.id, type: "EVDREQ" })],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
