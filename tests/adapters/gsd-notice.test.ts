import { readFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  OperationalNoticeSchema,
  emitGsdOperationalNotice,
} from "../../src/adapters/gsd/operational-notice.js";

const createGsdRoot = async (): Promise<{ root: string; summaryPath: string }> => {
  const root = await mkdtemp(join(tmpdir(), "ariadne-notice-"));
  const summaryPath = join(root, ".planning", "phases", "01-foundation", "SUMMARY.md");
  await mkdir(join(root, ".planning", "phases", "01-foundation"), { recursive: true });
  await writeFile(summaryPath, "# Completed\nDo not mutate this history.\n");
  return { root, summaryPath };
};

describe("GSD operational notices", () => {
  it("appends a validated notice, atomically registers it, and emits the exact banner", async () => {
    const { root, summaryPath } = await createGsdRoot();
    try {
      const banners: string[] = [];
      const before = await readFile(summaryPath, "utf8");
      const notice = await emitGsdOperationalNotice(
        root,
        {
          falsifiedId: "ASM-007",
          evidenceId: "EVD-044",
          affectedIds: ["CAN-002", "DEC-003"],
          reason: "Measured latency falsifies the assumption.",
          timestamp: "2026-08-20T00:00:00.000Z",
        },
        (banner) => banners.push(banner),
      );

      expect(OperationalNoticeSchema.safeParse(notice).success).toBe(true);
      expect(notice).toMatchObject({
        id: "NOT-001",
        falsified_id: "ASM-007",
        evidence_id: "EVD-044",
        affected_ids: ["CAN-002", "DEC-003"],
        owner: "Ariadne",
        next_action: expect.any(String),
        revaluation_condition: expect.any(String),
      });
      expect(banners[0]).toContain("⚠️ ARIADNE OPERATIONAL NOTICE");
      expect(await readFile(summaryPath, "utf8")).toBe(before);

      const lines = (await readFile(join(root, ".planning", "ariadne", "NOTICES.jsonl"), "utf8"))
        .trim()
        .split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ id: "NOT-001" });

      const state = JSON.parse(
        await readFile(join(root, ".planning", "ariadne", "STATE.yaml"), "utf8"),
      ) as { active_notices: string[] };
      expect(state.active_notices).toEqual(["NOT-001"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reuses the same notice for a repeated falsified/evidence pair", async () => {
    const { root } = await createGsdRoot();
    try {
      const first = await emitGsdOperationalNotice(root, {
        falsifiedId: "HYP-004",
        evidenceId: "EVD-045",
        affectedIds: ["CAN-009"],
        timestamp: "2026-08-20T00:00:00.000Z",
      });
      const second = await emitGsdOperationalNotice(root, {
        falsifiedId: "HYP-004",
        evidenceId: "EVD-045",
        affectedIds: ["CAN-009", "DEC-010"],
        timestamp: "2026-08-21T00:00:00.000Z",
      });

      expect(second).toEqual(first);
      expect(
        (await readFile(join(root, ".planning", "ariadne", "NOTICES.jsonl"), "utf8"))
          .trim()
          .split("\n"),
      ).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("serializes concurrent pairs and recovers an incomplete final record", async () => {
    const { root } = await createGsdRoot();
    try {
      const [first, second] = await Promise.all([
        emitGsdOperationalNotice(root, {
          falsifiedId: "ASM-001",
          evidenceId: "EVD-001",
          affectedIds: ["CAN-001"],
        }),
        emitGsdOperationalNotice(root, {
          falsifiedId: "HYP-002",
          evidenceId: "EVD-002",
          affectedIds: ["CAN-002"],
        }),
      ]);
      expect(new Set([first.id, second.id])).toEqual(new Set(["NOT-001", "NOT-002"]));

      const noticesPath = join(root, ".planning", "ariadne", "NOTICES.jsonl");
      const contents = await readFile(noticesPath, "utf8");
      await writeFile(noticesPath, `${contents}{"kind":"operational_notice"`, "utf8");

      const recovered = await emitGsdOperationalNotice(root, {
        falsifiedId: "ASM-003",
        evidenceId: "EVD-003",
        affectedIds: ["CAN-003"],
      });
      expect(recovered.id).toBe("NOT-003");
      expect((await readFile(noticesPath, "utf8")).trim().split("\n")).toHaveLength(3);
      expect(JSON.parse(await readFile(join(root, ".planning", "ariadne", "STATE.yaml"), "utf8"))).toMatchObject({
        active_notices: ["NOT-001", "NOT-002", "NOT-003"],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects non-falsification IDs instead of writing an operational record", async () => {
    const { root } = await createGsdRoot();
    try {
      await expect(
        emitGsdOperationalNotice(root, {
          falsifiedId: "CAN-001",
          evidenceId: "EVD-001",
          affectedIds: ["CAN-002"],
        }),
      ).rejects.toThrow(/ASM|HYP/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
