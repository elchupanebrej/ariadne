import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GraphStorage } from "../../src/graph/storage.js";

const node = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  type: "TASK" as const,
  provenance_type: "FACT" as const,
  title: `Title of ${id}`,
  statement: `Statement of ${id}`,
  ...overrides,
});

const cardPath = (directory: string, id: string) =>
  join(directory, "cards", `${id}.md`);

describe("GraphStorage card files", () => {
  it("writes a card file in the same transaction as INDEX.md", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-cards-create-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.appendNode(node("TASK-001", { confidence_level: 0.9 }));

      const card = await readFile(cardPath(directory, "TASK-001"), "utf8");
      expect(card).toContain("# TASK-001: Title of TASK-001");
      expect(card).toContain("- Status: ACTIVE");
      expect(card).toContain("- Provenance: FACT");
      expect(card).toContain("- Type: TASK");
      expect(card).toMatch(/- Revised: \d{4}-\d{2}-\d{2}/u);
      expect(card).toContain("Statement of TASK-001");
      expect(card).toContain('"confidence_level": 0.9');
      expect(await readFile(join(directory, "INDEX.md"), "utf8")).toContain("TASK-001");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("rewrites the card body when a node is updated", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-cards-update-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.appendNode(node("TASK-001"));
      await storage.appendNode(
        node("TASK-001", {
          statement: "Updated statement",
          status: "RESOLVED",
        }),
      );

      const card = await readFile(cardPath(directory, "TASK-001"), "utf8");
      expect(card).toContain("Updated statement");
      expect(card).not.toContain("Statement of TASK-001");
      expect(card).toContain("- Status: RESOLVED");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("keeps the card file on removal and updates only the tombstone header", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-cards-tombstone-"));

    try {
      const storage = new GraphStorage(directory);
      await storage.appendNode(node("TASK-001"));
      const before = await readFile(cardPath(directory, "TASK-001"), "utf8");

      await storage.appendNode({ ...node("TASK-001"), status: "REMOVED", tombstone: true });

      const after = await readFile(cardPath(directory, "TASK-001"), "utf8");
      expect(after).toContain("- Status: REMOVED");
      expect(after).toContain("Statement of TASK-001");
      expect(after).not.toBe(before);

      await storage.appendNode({
        ...node("HYP-002"),
        type: "HYP" as const,
        provenance_type: "ASSUMED" as const,
      });
      await storage.appendNode({
        ...node("EVD-003"),
        type: "EVD" as const,
        provenance_type: "MEASURED" as const,
      });
      await storage.appendNode({
        ...node("HYP-002"),
        type: "HYP" as const,
        provenance_type: "ASSUMED" as const,
        status: "INVALIDATED",
        tombstone: true,
      });
      expect(await readFile(cardPath(directory, "HYP-002"), "utf8")).toContain(
        "- Status: INVALIDATED",
      );
      expect(await readdir(join(directory, "cards")).then((files) => files.sort())).toEqual([
        "EVD-003.md",
        "HYP-002.md",
        "TASK-001.md",
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("mirrors cards under .planning/ariadne when the storage root is the gsd overlay", async () => {
    const root = await mkdtemp(join(tmpdir(), "ariadne-cards-gsd-"));
    const directory = join(root, ".planning", "ariadne");

    try {
      const storage = new GraphStorage(directory);
      await storage.appendNode(node("TASK-001"));

      const card = await readFile(cardPath(directory, "TASK-001"), "utf8");
      expect(card).toContain("# TASK-001: Title of TASK-001");
      expect(await readdir(join(directory))).toContain("INDEX.md");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("regenerates cards for pre-existing nodes alongside regenerateIndex", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ariadne-cards-regen-"));

    try {
      const event = (id: string) =>
        JSON.stringify({ kind: "node", node: node(id) });
      await writeFile(
        join(directory, "GRAPH.jsonl"),
        `${event("TASK-001")}\n${event("TASK-002")}\n`,
        "utf8",
      );
      const storage = new GraphStorage(directory);
      await storage.regenerateIndex();

      for (const id of ["TASK-001", "TASK-002"]) {
        expect(await readFile(cardPath(directory, id), "utf8")).toContain(
          `# ${id}: Title of ${id}`,
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
