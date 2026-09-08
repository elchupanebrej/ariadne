import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readFramedRecords } from "../../src/graph/journal.js";
import {
  applyEvent,
  createAttempt,
  joinDirectResult,
  loadAttempt,
  nextDisposition,
  pointerDigest,
  reconstructNextAction,
  saveAttempt,
} from "../../src/harness/attempt.js";
import { hourFromNow, newRoot } from "./helpers.js";

const readLedgerRecord = async (
  root: string,
  id: string,
): Promise<Record<string, unknown>> => {
  const records = await readFramedRecords(
    join(root, ".orchestration", "attempts", `${id}.jsonl`),
  );
  return records.at(-1)?.payload as Record<string, unknown>;
};

const builtModule = new URL("../../dist/harness/attempt.js", import.meta.url).href;

describe("thin Orchestration Attempt continuity", () => {
  it("retains only the declared pointer-only fields on disk", async () => {
    const root = await newRoot();
    await saveAttempt(
      root,
      createAttempt({ id: "att-fields", pins: ["contract://method@sha256:m1"], replayBudget: 1 }),
    );
    const persisted = await readLedgerRecord(root, "att-fields");
    expect(Object.keys(persisted).sort()).toEqual(
      [
        "cancellationIntent",
        "cursor",
        "dispatches",
        "id",
        "ownerPointers",
        "pins",
        "replayBudget",
        "revision",
        "status",
      ].sort(),
    );
    expect(JSON.stringify(persisted)).not.toMatch(/payload|prompt|content|body/i);
  });

  it("cold start reconstructs exactly one disposition across a session boundary", async () => {
    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "att-cold", replayBudget: 2 }));

    const reconstructed = await reconstructNextAction(root, "att-cold", {
      request: { knownRevision: 1 },
    });
    expect(reconstructed).toEqual({ action: "dispatch" });

    const loaded = await loadAttempt(root, "att-cold");
    expect(loaded.status).toBe("created");
    expect(loaded.replayBudget).toBe(2);
    expect(loaded.pins).toEqual([]);
  });

  it("mid-run reset falls back to owner effect inspection", async () => {
    const root = await newRoot();
    const attempt = createAttempt({ id: "att-midrun", replayBudget: 3 });
    attempt.status = "running";
    attempt.dispatches = 1;
    await saveAttempt(root, attempt);

    const first = await reconstructNextAction(root, "att-midrun");
    const second = await reconstructNextAction(root, "att-midrun");
    expect(first.action).toBe("inspect_effects");
    expect(first.reason).toBe("mid_run_reset_effects_unknown");
    expect(first.authorityRef).toBe("owner://authority/effect-inspection");
    expect(second).toEqual(first);
  });

  it("approval waiting resumes only from a bound unexpired pointer with revalidated host permission", async () => {
    const root = await newRoot();
    const approvalRef = "host://approval/approval-101";
    const attempt = createAttempt({
      id: "att-approve",
      pins: [approvalRef],
      deadline: hourFromNow(1),
      replayBudget: 1,
    });
    attempt.status = "waiting";
    attempt.pendingApprovalRef = approvalRef;
    await saveAttempt(root, attempt);

    await expect(reconstructNextAction(root, "att-approve")).resolves.toMatchObject({
      action: "escalate",
      reason: "host_permission_unverified",
    });
    await expect(
      reconstructNextAction(root, "att-approve", {
        hasHostPermission: () => Promise.resolve(false),
      }),
    ).resolves.toMatchObject({ action: "escalate", reason: "host_permission_lost" });
    await expect(
      reconstructNextAction(root, "att-approve", {
        hasHostPermission: () => Promise.resolve(true),
      }),
    ).resolves.toMatchObject({ action: "resume_approval", approvalRef });
  });

  it("rejects expired or unbound approvals fail-closed", async () => {
    const root = await newRoot();
    const approvalRef = "host://approval/approval-102";

    const expired = createAttempt({
      id: "att-expired",
      pins: [approvalRef],
      deadline: hourFromNow(-1),
    });
    expired.status = "waiting";
    expired.pendingApprovalRef = approvalRef;
    await saveAttempt(root, expired);
    await expect(
      reconstructNextAction(root, "att-expired", {
        hasHostPermission: () => Promise.resolve(true),
      }),
    ).resolves.toMatchObject({ action: "escalate", reason: "approval_expired" });

    const unbound = createAttempt({ id: "att-unbound" });
    unbound.status = "waiting";
    unbound.pendingApprovalRef = approvalRef;
    await saveAttempt(root, unbound);
    await expect(
      reconstructNextAction(root, "att-unbound", {
        hasHostPermission: () => Promise.resolve(true),
      }),
    ).resolves.toMatchObject({ action: "escalate", reason: "approval_not_bound_to_attempt" });

    const corruptDeadline = createAttempt({ id: "att-corrupt-deadline", pins: [approvalRef] });
    corruptDeadline.status = "waiting";
    corruptDeadline.deadline = "not-a-timestamp";
    corruptDeadline.pendingApprovalRef = approvalRef;
    await saveAttempt(root, corruptDeadline);
    await expect(
      reconstructNextAction(root, "att-corrupt-deadline", {
        hasHostPermission: () => Promise.resolve(true),
      }),
    ).resolves.toMatchObject({ action: "escalate", reason: "approval_deadline_invalid" });
  });

  it("treats equal cursor and digest as idempotent but refuses conflicts and gaps", () => {
    const base = createAttempt({ id: "att-events" });
    const advanced = applyEvent(base, 1, "digest-a");
    expect(advanced.cursor).toBe(1);
    expect(advanced.revision).toBe(base.revision + 1);

    expect(applyEvent(advanced, 1, "digest-a")).toBe(advanced);
    expect(() => applyEvent(advanced, 1, "digest-b")).toThrow(/conflict, gap/);
    expect(() => applyEvent(advanced, 3, "digest-c")).toThrow(/conflict, gap/);
  });

  it("joins direct Matt and Ariadne receipts as pointers without payload copying", async () => {
    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "att-direct", replayBudget: 1 }));

    const mattJoined = await joinDirectResult(root, "att-direct", {
      receiptRef: "matt://receipt/m-1",
      artifactRef: "file://artifacts/spec.json",
    });
    const ariadneJoined = await joinDirectResult(root, "att-direct", {
      receiptRef: "ariadne://receipt/a-1",
    });
    expect(mattJoined.ok).toBe(true);
    expect(ariadneJoined.ok).toBe(true);
    if (ariadneJoined.ok) {
      expect(ariadneJoined.attempt.ownerPointers).toEqual([
        "matt://receipt/m-1",
        "file://artifacts/spec.json",
        "ariadne://receipt/a-1",
      ]);
    }

    const reread = await readLedgerRecord(root, "att-direct");
    expect(reread.ownerPointers).toEqual([
      "matt://receipt/m-1",
      "file://artifacts/spec.json",
      "ariadne://receipt/a-1",
    ]);
    expect(Object.keys(reread)).not.toContain("payloads");

    const before = (await loadAttempt(root, "att-direct")).revision;
    const duplicate = await joinDirectResult(root, "att-direct", {
      receiptRef: "matt://receipt/m-1",
    });
    expect(duplicate.ok && duplicate.attempt.revision).toBe(before);

    const invalidOwner = await joinDirectResult(root, "att-direct", {
      receiptRef: "kernel://receipt/x",
    });
    expect(invalidOwner).toMatchObject({ ok: false, reason: "receipt_invalid" });
  });

  it("verifies cold start and mid-run reset across a real process boundary", async () => {
    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "att-proc", replayBudget: 5 }));

    const probe = join(root, "..", `probe-${Date.now()}.mjs`);
    await writeFile(
      probe,
      [
        `import { loadAttempt, nextDisposition } from ${JSON.stringify(builtModule)};`,
        `const [root, id] = process.argv.slice(2);`,
        `const attempt = await loadAttempt(root, id);`,
        `process.stdout.write(JSON.stringify(await nextDisposition(attempt, { request: { knownRevision: attempt.revision } })));`,
      ].join("\n"),
      "utf8",
    );
    const runProbe = (id: string) =>
      spawnSync(process.execPath, [probe, root, id], { encoding: "utf8" });

    const cold = runProbe("att-proc");
    expect(cold.stderr).toBe("");
    expect(cold.status).toBe(0);
    expect(JSON.parse(cold.stdout.trim())).toEqual({ action: "dispatch" });

    const midRun = createAttempt({ id: "att-proc-midrun", replayBudget: 5 });
    midRun.status = "running";
    midRun.dispatches = 1;
    await saveAttempt(root, midRun);
    const reset = runProbe("att-proc-midrun");
    expect(reset.stderr).toBe("");
    expect(reset.status).toBe(0);
    expect(JSON.parse(reset.stdout.trim())).toMatchObject({
      action: "inspect_effects",
      reason: "mid_run_reset_effects_unknown",
    });
  });

  it("escalates deterministically when the replay budget is exhausted", async () => {
    const root = await newRoot();
    const attempt = createAttempt({ id: "att-budget", replayBudget: 1 });
    attempt.dispatches = 1;
    await saveAttempt(root, attempt);
    await expect(
      reconstructNextAction(root, "att-budget", { request: { knownRevision: 1 } }),
    ).resolves.toMatchObject({
      action: "escalate",
      reason: "replay_budget_exhausted",
    });
  });

  it("derives stable digests for pointer events", () => {
    expect(pointerDigest("matt://receipt/m-1")).toBe(pointerDigest("matt://receipt/m-1"));
    expect(pointerDigest("matt://receipt/m-1")).not.toBe(pointerDigest("matt://receipt/m-2"));
  });

  it("acknowledges cancellation intent before any other nonterminal action", async () => {
    const root = await newRoot();
    const attempt = createAttempt({ id: "att-cancel", replayBudget: 4 });
    attempt.status = "waiting";
    attempt.cancellationIntent = true;
    await saveAttempt(root, attempt);
    await expect(reconstructNextAction(root, "att-cancel")).resolves.toEqual({
      action: "acknowledge_cancellation",
    });
  });

  it("completes terminal attempts without further action", async () => {
    const root = await newRoot();
    const attempt = createAttempt({ id: "att-done" });
    attempt.status = "succeeded";
    await saveAttempt(root, attempt);
    await expect(reconstructNextAction(root, "att-done")).resolves.toEqual({
      action: "complete",
    });
  });

  it("fails closed when repository-visible state is missing or corrupted", async () => {
    const root = await newRoot();
    await expect(loadAttempt(root, "missing")).rejects.toThrow(/Attempt not found/);

    await saveAttempt(root, createAttempt({ id: "att-corrupt" }));
    const ledgerPath = join(root, ".orchestration", "attempts", "att-corrupt.jsonl");
    await writeFile(ledgerPath, "{not json", "utf8");
    await expect(loadAttempt(root, "att-corrupt")).rejects.toThrow(/Canonical history|Cannot read attempt/);
  });
});
