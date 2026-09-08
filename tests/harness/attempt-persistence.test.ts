import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readFramedRecords, verifyFrame } from "../../src/graph/journal.js";
import {
  createAttempt,
  joinDirectResult,
  loadAttempt,
  planReplay,
  resolveCancellation,
  resolveEffects,
  saveAttempt,
  type OrchestrationAttempt,
} from "../../src/harness/attempt.js";

const attemptLedger = (root: string, id: string): string =>
  path.join(root, ".orchestration", "attempts", `${id}.jsonl`);

const legacyAttemptLedger = (root: string, id: string): string =>
  path.join(root, "attempts", `${id}.jsonl`);

const expectCanonicalLedger = async (root: string, id: string, length: number): Promise<void> => {
  const records = await readFramedRecords(attemptLedger(root, id));
  expect(records).toHaveLength(length);
  expect(records.map(({ sequence }) => sequence)).toEqual(
    Array.from({ length }, (_, index) => index + 1),
  );
  expect(records.every((record) => verifyFrame(record))).toBe(true);
  expect(fs.existsSync(legacyAttemptLedger(root, id))).toBe(false);
};

const createRoot = (): string => fs.mkdtempSync(path.join(os.tmpdir(), "ariadne-attempt-path-"));

describe("orchestration attempt hardened mutation path", () => {
  it("routes every state mutation through one framed canonical attempt ledger", async () => {
    const cases: Array<{
      id: string;
      prepare: (attempt: OrchestrationAttempt) => OrchestrationAttempt;
      mutate: (root: string, id: string) => Promise<unknown>;
    }> = [
      {
        id: "attempt-join",
        prepare: (attempt: OrchestrationAttempt): OrchestrationAttempt => attempt,
        mutate: (root: string, attemptId: string) =>
          joinDirectResult(root, attemptId, { receiptRef: "matt://receipt/join" }),
      },
      {
        id: "attempt-replay",
        prepare: (attempt: OrchestrationAttempt): OrchestrationAttempt => ({
          ...attempt,
          idempotencyKey: "attempt-replay-key",
          ownerPointers: ["owner://receipt/inspection"],
          replayBudget: 1,
        }),
        mutate: (root: string, attemptId: string) =>
          planReplay(root, attemptId, {
            operation: "ariadne.graph",
            key: "attempt-replay-key",
            deadline: new Date(Date.now() + 3_600_000).toISOString(),
          }),
      },
      {
        id: "attempt-effects",
        prepare: (attempt: OrchestrationAttempt): OrchestrationAttempt => ({
          ...attempt,
          status: "running",
        }),
        mutate: (root: string, attemptId: string) =>
          resolveEffects(root, attemptId, "owner://receipt/effect", "committed"),
      },
      {
        id: "attempt-cancellation",
        prepare: (attempt: OrchestrationAttempt): OrchestrationAttempt => ({
          ...attempt,
          status: "waiting",
          cancellationIntent: true,
        }),
        mutate: (root: string, attemptId: string) =>
          resolveCancellation(root, attemptId, "host://receipt/cancel", "acknowledged"),
      },
    ];

    for (const { id, prepare, mutate } of cases) {
      const root = createRoot();
      try {
        await saveAttempt(root, prepare(createAttempt({ id })));
        await mutate(root, id);
        await expectCanonicalLedger(root, id, 2);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("validates attempt state and revision continuity before appending", async () => {
    const root = createRoot();
    const id = "attempt-validation";
    try {
      const first = createAttempt({ id });
      await expect(saveAttempt(root, { ...first, revision: 2 })).rejects.toMatchObject({
        code: "INVALID_INPUT",
      });
      expect(fs.existsSync(attemptLedger(root, id))).toBe(false);

      await saveAttempt(root, first);
      await expect(
        saveAttempt(root, { ...first, revision: 3, dispatches: Number.NaN }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(readFramedRecords(attemptLedger(root, id))).resolves.toHaveLength(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps attempt reads non-mutating when the canonical tail lacks a newline", async () => {
    const root = createRoot();
    const id = "attempt-read-only";
    try {
      await saveAttempt(root, createAttempt({ id }));
      const ledgerPath = attemptLedger(root, id);
      const unterminated = fs.readFileSync(ledgerPath, "utf8").trimEnd();
      fs.writeFileSync(ledgerPath, unterminated, "utf8");

      await expect(loadAttempt(root, id)).resolves.toMatchObject({ id, revision: 1 });
      expect(fs.readFileSync(ledgerPath, "utf8")).toBe(unterminated);
      expect(fs.existsSync(path.join(root, ".lock"))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["joinDirectResult", (root: string, id: string) =>
      joinDirectResult(root, id, { receiptRef: "matt://receipt/legacy" })],
    ["planReplay", (root: string, id: string) =>
      planReplay(root, id, {
        operation: "ariadne.graph",
        key: "legacy-key",
        deadline: new Date(Date.now() + 3_600_000).toISOString(),
      })],
    ["resolveEffects", (root: string, id: string) =>
      resolveEffects(root, id, "owner://receipt/legacy", "committed")],
    ["resolveCancellation", (root: string, id: string) =>
      resolveCancellation(root, id, "host://receipt/legacy", "acknowledged")],
  ] as const)("rejects %s when a legacy attempt ledger exists", async (_name, mutate) => {
    const root = createRoot();
    const id = "attempt-legacy-gate";
    const legacyPath = legacyAttemptLedger(root, id);
    const legacyContent = `${JSON.stringify({ id, revision: 1 })}\n`;
    try {
      fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
      fs.writeFileSync(legacyPath, legacyContent, "utf8");

      await expect(mutate(root, id)).rejects.toMatchObject({ code: "MIGRATION_REQUIRED" });
      expect(fs.readFileSync(legacyPath, "utf8")).toBe(legacyContent);
      expect(fs.existsSync(attemptLedger(root, id))).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
