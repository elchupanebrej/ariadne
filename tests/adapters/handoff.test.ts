import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";
import { generateGrillSubstrate, generateHandoff } from "../../src/adapters/handoff/generator.js";

const node = (
  id: string,
  type: Node["type"],
  provenance_type: Node["provenance_type"],
  statement: string,
  extra: Record<string, unknown> = {},
): Node =>
  NodeSchema.parse({ id, type, provenance_type, statement, ...extra });

const graph = (nodes: Node[], edges: MaterializedGraph["edges"]): MaterializedGraph => ({
  nodes,
  edges,
});

describe("generateHandoff", () => {
  it("writes a concise GSD handoff with verified basis, invariants, ADRs, and /to-spec", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-handoff-gsd-"));
    try {
      await mkdir(join(root, ".planning"), { recursive: true });
      const result = await generateHandoff(
        "DEC-001",
        graph(
          [
            node("DEC-001", "DEC", "DECIDED", "Use the append-only graph store.", {
              adr_refs: ["ADR-0002"],
              architectural: true,
            }),
            node("OBS-001", "OBS", "FACT", "GRAPH.jsonl is append-only.", {
              adr_ref: "ADR-0002",
            }),
            node("ASM-001", "ASM", "ASSUMED", "State remains local.", {
              invariant: true,
            }),
            node("CAN-001", "CAN", "PROPOSED", "An unverified alternative."),
          ],
          [
            { source: "DEC-001", target: "OBS-001", type: "depends_on" },
            { source: "DEC-001", target: "ASM-001", type: "derived_from" },
            { source: "DEC-001", target: "CAN-001", type: "depends_on" },
          ],
        ),
        { rootDirectory: root, changeRadius: "high" },
      );

      expect(result.artifactPath).toBe(join(root, ".planning", "ariadne", "HANDOFF.md"));
      expect(result.recommendedCommand).toBe("/to-spec");
      expect(result.content).toContain("OBS-001");
      expect(result.content).toContain("GRAPH.jsonl is append-only.");
      expect(result.content).toContain("ASM-001");
      expect(result.content).toContain("ADR-0002");
      expect(result.content).not.toContain("CAN-001");
      expect(await readFile(result.artifactPath, "utf8")).toBe(result.content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses standalone output and recommends /to-tickets for bounded changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-handoff-standalone-"));
    try {
      const result = await generateHandoff(
        "DEC-002",
        graph(
          [
            node("DEC-002", "DEC", "DECIDED", "Rename one internal helper."),
            node("OBS-002", "OBS", "MEASURED", "The helper has two callers."),
          ],
          [{ source: "DEC-002", target: "OBS-002", type: "depends_on" }],
        ),
        { rootDirectory: root, changeRadius: "bounded" },
      );

      expect(result.artifactPath).toBe(join(root, ".ariadne", "HANDOFF.md"));
      expect(result.recommendedCommand).toBe("/to-tickets");
      expect(existsSync(result.artifactPath)).toBe(true);
      expect(await readdir(root)).toEqual([".ariadne"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires an existing DEC node", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-handoff-missing-"));
    try {
      await expect(
        generateHandoff("DEC-404", graph([], []), { rootDirectory: root }),
      ).rejects.toThrow(/DEC-404|decision/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not mutate graph inputs or create extra state files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-handoff-side-effects-"));
    try {
      const input = graph(
        [node("DEC-003", "DEC", "DECIDED", "Keep the bounded change.")],
        [],
      );
      const before = JSON.stringify(input);
      await generateHandoff("DEC-003", input, { rootDirectory: root });
      expect(JSON.stringify(input)).toBe(before);
      expect(await readdir(root)).toEqual([".ariadne"]);
      expect(await readdir(join(root, ".ariadne"))).toEqual(["HANDOFF.md"]);
      expect(existsSync(join(root, ".ariadne", "STATE.yaml"))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses a handoff when its decision depends on a reopened decision", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-handoff-reopened-"));
    try {
      await expect(
        generateHandoff(
          "DEC-004",
          graph(
            [
              node("DEC-004", "DEC", "DECIDED", "Use the selected mechanism."),
              node("DEC-005", "DEC", "DECIDED", "The basis was reopened.", {
                status: "RE-OPENED",
              }),
            ],
            [{ source: "DEC-004", target: "DEC-005", type: "depends_on" }],
          ),
          { rootDirectory: root },
        ),
      ).rejects.toThrow(/reopened|blocking/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("generateGrillSubstrate", () => {
  it("writes a linked pre-decision substrate without requiring DEC", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-grill-substrate-"));
    try {
      await mkdir(join(root, ".ariadne"), { recursive: true });
      await Promise.all([
        writeFile(join(root, ".ariadne", "GRAPH.jsonl"), "", "utf8"),
        writeFile(join(root, ".ariadne", "INDEX.md"), "# Index\n", "utf8"),
        writeFile(join(root, ".ariadne", "STATE.yaml"), "{}\n", "utf8"),
      ]);
      const result = await generateGrillSubstrate(
        graph([
          node("FRAME-001", "FRAME", "PROPOSED", "The trigger remains uncertain."),
          node("UNK-001", "UNK", "UNKNOWN", "What is the minimum trigger?"),
          node("ASM-001", "ASM", "ASSUMED", "The user can inspect local files."),
          node("CTR-001", "CTR", "PROPOSED", "Recall conflicts with context load."),
          node("EVD-001", "EVD", "FACT", "The repository has a graph index."),
          node("CAN-001", "CAN", "PROPOSED", "Use a dedicated preflight."),
        ], []),
        { rootDirectory: root },
      );

      expect(result.artifactPath).toBe(join(root, ".ariadne", "GRILL-SUBSTRATE.md"));
      expect(result.content).toContain("[UNK-001](<");
      expect(result.content).toContain("GRAPH.jsonl");
      expect(result.content).toContain("What is the minimum trigger?");
      expect(result.content).toContain("## Assumptions");
      expect(result.content).toContain("## Contradictions");
      expect(result.content).toContain("## Evidence and requests");
      expect(result.content).toContain("➡️ Recommended answer:");
      expect(result.content).not.toContain("Decision:");
      expect(await readFile(result.artifactPath, "utf8")).toBe(result.content);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
