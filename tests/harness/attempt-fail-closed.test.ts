import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  BoundaryError,
  createAttempt,
  joinDirectResult,
  loadAttempt,
  nextDisposition,
  reconstructNextAction,
  saveAttempt,
  transition,
  type AttemptDisposition,
  type AttemptReason,
  type OrchestrationAttempt,
} from "../../src/harness/attempt.js";
import { hourFromNow, newRoot } from "./helpers.js";

describe("fail-closed orchestration boundaries", () => {
  it("gives each unsafe boundary one stable reason and disposition", async () => {
    const cases: Array<{
      reason: AttemptReason;
      produce: () => Promise<AttemptDisposition>;
    }> = [
      {
        reason: "approval_expired",
        produce: async () => {
          const root = await newRoot();
          const attempt = createAttempt({
            id: "b-expired",
            pins: ["host://approval/a1"],
            deadline: hourFromNow(-1),
          });
          attempt.status = "waiting";
          attempt.pendingApprovalRef = "host://approval/a1";
          await saveAttempt(root, attempt);
          return reconstructNextAction(root, "b-expired");
        },
      },
      {
        reason: "stale_revision",
        produce: async () => {
          const root = await newRoot();
          await saveAttempt(root, createAttempt({ id: "b-stale", replayBudget: 2 }));
          return reconstructNextAction(root, "b-stale", {
            request: { knownRevision: 99 },
          });
        },
      },
      {
        reason: "pin_mismatch",
        produce: async () => {
          const root = await newRoot();
          await saveAttempt(
            root,
            createAttempt({ id: "b-pins", pins: ["contract://m1"], replayBudget: 2 }),
          );
          return reconstructNextAction(root, "b-pins", {
            request: {
              knownRevision: 1,
              requestedPins: ["contract://m1", "contract://drifted"],
            },
          });
        },
      },
      {
        reason: "unsupported_capability",
        produce: async () => {
          const root = await newRoot();
          await saveAttempt(root, createAttempt({ id: "b-cap", replayBudget: 2 }));
          return reconstructNextAction(root, "b-cap", {
            request: {
              knownRevision: 1,
              capability: "time-travel",
              supportedCapabilities: ["reasoning"],
            },
          });
        },
      },
    ];
    for (const { produce, reason } of cases) {
      const disposition = await produce();
      expect(disposition.action).toBe("escalate");
      expect(disposition.reason).toBe(reason);
    }
  });

  it("marks ambiguous effects as owner inspection with a stable reason", async () => {
    const root = await newRoot();
    const attempt = createAttempt({ id: "b-ambiguous" });
    attempt.status = "running";
    await saveAttempt(root, attempt);
    const disposition = await reconstructNextAction(root, "b-ambiguous");
    expect(disposition.action).toBe("inspect_effects");
    expect(disposition.reason).toBe("mid_run_reset_effects_unknown");
  });

  it("equips every waiting or failed disposition with authority, evidence, pending action, and resume predicate", async () => {
    const root = await newRoot();
    const approvalRef = "host://approval/equip";
    const attempt = createAttempt({
      id: "b-equipped",
      pins: [approvalRef],
      deadline: hourFromNow(-1),
    });
    attempt.status = "waiting";
    attempt.pendingApprovalRef = approvalRef;
    await saveAttempt(root, attempt);

    const disposition = await reconstructNextAction(root, "b-equipped");
    expect(disposition.reason).toBe("approval_expired");
    expect(disposition.authorityRef).toMatch(/:\/\//);
    expect(disposition.evidenceRefs).toEqual([approvalRef]);
    expect(disposition.pendingAction).toMatch(/:\/\//);
    expect(typeof disposition.resumePredicate).toBe("string");
    expect(disposition.resumePredicate!.length).toBeGreaterThan(0);
    expect(disposition.deadline).toBe(attempt.deadline);
  });

  it("refuses stale revisions and routes existing dispatch intent to inspection", async () => {
    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "b-intent", replayBudget: 3 }));
    const fresh = await loadAttempt(root, "b-intent");

    const stale = await nextDisposition(fresh, { request: { knownRevision: 0 } });
    expect(stale).toMatchObject({ action: "escalate", reason: "stale_revision" });

    const current = await nextDisposition(fresh, {
      request: { knownRevision: fresh.revision },
    });
    expect(current.action).toBe("dispatch");

    const intentRouted = await nextDisposition(transition(fresh, "running"));
    expect(intentRouted.action).toBe("inspect_effects");
  });

  it("fails closed on invalid transitions, cursor regressions, and mismatched join owners", async () => {
    const done = transition(transition(createAttempt({ id: "t-done" }), "running"), "succeeded");
    expect(() => transition(done, "running")).toThrow(BoundaryError);
    let caught: BoundaryError | undefined;
    try {
      transition(done, "running");
    } catch (error) {
      caught = error as BoundaryError;
    }
    expect(caught?.reason).toBe("invalid_transition");
    expect(caught?.toDisposition()).toMatchObject({
      action: "escalate",
      reason: "invalid_transition",
      authorityRef: "harness://authority/lifecycle",
    });

    const base = createAttempt({ id: "t-events" });
    const advanced = applyEvent(base, 1, "d1");
    expect(() => applyEvent(advanced, 1, "d2")).toThrow(BoundaryError);
    try {
      applyEvent(advanced, 1, "d2");
    } catch (error) {
      expect((error as BoundaryError).reason).toBe("cursor_conflict");
    }
    expect(() => applyEvent(advanced, 0, "d0")).toThrow(BoundaryError);

    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "t-join" }));
    const mismatched = await joinDirectResult(root, "t-join", {
      receiptRef: "kernel://receipt/nope",
    });
    expect(mismatched.ok).toBe(false);
    if (!mismatched.ok) {
      expect(mismatched.reason).toBe("receipt_invalid");
      expect(mismatched.authorityRef).toMatch(/:\/\//);
      expect(mismatched.evidenceRefs).toEqual(["kernel://receipt/nope"]);
      expect(mismatched.pendingAction).toMatch(/:\/\//);
      expect(mismatched.resumePredicate).toMatch(/\S/);
    }
  });

  it("recovery accepts an incomplete final record but rejects earlier committed corruption", async () => {
    const root = await newRoot();
    const first = createAttempt({ id: "b-ledger", replayBudget: 5 });
    const second: OrchestrationAttempt = { ...first, status: "running", revision: 2 };
    await saveAttempt(root, first);
    await saveAttempt(root, second);

    // Torn write on the final line is tolerated; recovery falls back.
    const ledgerPath = join(root, "attempts", "b-ledger.jsonl");
    const history = await readFile(ledgerPath, "utf8");
    await writeFile(ledgerPath, history + '{"id":"b-ledger","revi', "utf8");
    const recovered = await loadAttempt(root, "b-ledger");
    expect(recovered.revision).toBe(2);
    expect(recovered.status).toBe("running");

    // A shape-invalid final record counts as incomplete and is dropped too.
    await writeFile(
      ledgerPath,
      `${history}${JSON.stringify({ id: "b-ledger", revision: 9 })}\n`,
      "utf8",
    );
    expect((await loadAttempt(root, "b-ledger")).revision).toBe(2);

    // Corruption inside committed history fails closed.
    await writeFile(ledgerPath, `garbage\n${history}`, "utf8");
    await expect(loadAttempt(root, "b-ledger")).rejects.toThrow(BoundaryError);

    // A shape-invalid committed record fails closed even though it parses.
    await writeFile(ledgerPath, `${JSON.stringify({ id: "b-ledger" })}\n${history}`, "utf8");
    await expect(loadAttempt(root, "b-ledger")).rejects.toThrow(/Invalid committed history/);
  });

  it("distinguishes a missing attempt from corrupted state", async () => {
    const root = await newRoot();
    let caught: BoundaryError | undefined;
    try {
      await loadAttempt(root, "ghost");
    } catch (error) {
      caught = error as BoundaryError;
    }
    expect(caught?.reason).toBe("attempt_missing");
    expect(caught?.toDisposition().pendingAction).toBe("host://pending/register-attempt");

    await saveAttempt(root, createAttempt({ id: "b-real" }));
    const ledgerPath = join(root, "attempts", "b-real.jsonl");
    await writeFile(ledgerPath, "garbage\n", "utf8");
    try {
      await loadAttempt(root, "b-real");
      expect.unreachable();
    } catch (error) {
      expect((error as BoundaryError).reason).toBe("ledger_corrupt");
    }
  });

  it("never invents approval, effect status, compensation, or replay authority on failure paths", async () => {
    const root = await newRoot();
    await saveAttempt(root, createAttempt({ id: "b-noinvent", pins: [], replayBudget: 0 }));

    const escalated = await reconstructNextAction(root, "b-noinvent");
    expect(escalated.action).toBe("escalate");
    expect(escalated.approvalRef).toBeUndefined();
    expect(escalated.action).not.toBe("dispatch");
    expect(escalated.action).not.toBe("resume_approval");
    expect(JSON.stringify(escalated)).not.toMatch(/compensat|replay_authorized|succeeded/i);
  });
});
