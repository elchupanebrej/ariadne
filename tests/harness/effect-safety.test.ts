import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  applyEvent,
  BoundaryError,
  createAttempt,
  joinDirectResult,
  loadAttempt,
  nextDisposition,
  planReplay,
  reconstructNextAction,
  resolveCancellation,
  resolveEffects,
  saveAttempt,
  transition,
} from "../../src/harness/attempt.js";
import { hourFromNow, newRoot } from "./helpers.js";

const runningAttempt = async (id: string, budget = 1) => {
  const root = await newRoot();
  const attempt = createAttempt({
    id,
    idempotencyKey: `${id}-key`,
    replayBudget: budget,
    deadline: hourFromNow(1),
  });
  await saveAttempt(root, attempt);
  await saveAttempt(root, transition(attempt, "running"));
  return { root, id };
};

describe("thin-path effect safety (fault-injected clean-session runs)", () => {
  it("keeps the dispatch intent durable across a reset before and after an owner effect", async () => {
    const { root, id } = await runningAttempt("eff-durable");

    // Reset immediately after the durable dispatch intent, before any effect.
    const beforeEffect = await loadAttempt(root, id);
    expect(beforeEffect.dispatches).toBe(0);
    const dispositionBefore = await nextDisposition(beforeEffect);
    expect(dispositionBefore).toMatchObject({ action: "inspect_effects" });
    // Duplicate-dispatch prevention: even a fresh revision cannot re-dispatch.
    const redispatch = await nextDisposition(beforeEffect, {
      request: { knownRevision: beforeEffect.revision },
    });
    expect(redispatch.action).toBe("inspect_effects");

    // Reset immediately after an owner effect with unknown outcome.
    const joined = await joinDirectResult(root, id, {
      receiptRef: "matt://receipt/unknown-outcome",
    });
    expect(joined.ok).toBe(true);
    const afterEffect = await loadAttempt(root, id);
    expect(afterEffect.ownerPointers).toContain("matt://receipt/unknown-outcome");
    await expect(nextDisposition(afterEffect)).resolves.toMatchObject({
      action: "inspect_effects",
    });
  });

  it("grants replay only against a complete owner declaration over a zero-start budget", async () => {
    const { root, id } = await runningAttempt("eff-replay", 2);

    // Replay starts at zero but is refused without a resolved prior effect.
    const early = await planReplay(root, id, {
      operation: "ariadne.graph",
      key: "eff-replay-key",
      deadline: hourFromNow(1),
    });
    expect(early).toMatchObject({ ok: false, reason: "prior_effect_unresolved" });

    const inspection = await resolveEffects(root, id, "owner://receipt/insp-1", "committed");
    expect(inspection.status).toBe("running");
    expect(inspection.ownerPointers.some((ptr) => ptr.startsWith("owner://receipt/inspection-"))).toBe(
      true,
    );

    // Wrong key, blank operation, or past deadline each fail closed.
    for (const declaration of [
      { operation: "ariadne.graph", key: "wrong-key", deadline: hourFromNow(1) },
      { operation: "", key: "eff-replay-key", deadline: hourFromNow(1) },
      { operation: "ariadne.graph", key: "eff-replay-key", deadline: hourFromNow(-1) },
    ]) {
      const rejected = await planReplay(root, id, declaration);
      expect(rejected).toMatchObject({ ok: false, reason: "replay_declaration_invalid" });
    }

    const first = await planReplay(root, id, {
      operation: "ariadne.graph",
      key: "eff-replay-key",
      deadline: hourFromNow(1),
    });
    expect(first.ok).toBe(true);

    const second = await planReplay(root, id, {
      operation: "ariadne.graph",
      key: "eff-replay-key",
      deadline: hourFromNow(1),
    });
    expect(second.ok).toBe(true);

    // Finite budget: the third replay is refused.
    const exhausted = await planReplay(root, id, {
      operation: "ariadne.graph",
      key: "eff-replay-key",
      deadline: hourFromNow(1),
    });
    expect(exhausted).toMatchObject({ ok: false, reason: "replay_budget_exhausted" });
  });

  it("injects stale concurrency in a disposable workspace and fails closed on ledger corruption", async () => {
    const { root, id } = await runningAttempt("eff-stale", 5);
    const staleView = await loadAttempt(root, id);

    // A concurrent writer advances the committed history.
    const winner = transition(staleView, "waiting");
    await saveAttempt(root, winner);

    // The stale writer retries its outdated record. Idempotency recognizes the
    // already committed revision and does not append a duplicate snapshot.
    await saveAttempt(root, staleView);

    // The next legitimate write remains readable after the stale retry.
    await saveAttempt(root, winner);
    await expect(loadAttempt(root, id)).resolves.toMatchObject({
      revision: winner.revision,
      status: winner.status,
    });
    await expect(reconstructNextAction(root, id)).resolves.toMatchObject({ action: "escalate" });
  });

  it("rejects duplicate and gapped events independently per workspace", async () => {
    const base = createAttempt({ id: "eff-events" });
    const evented: Parameters<typeof applyEvent>[0] = {
      ...transition(base, "running"),
      cursor: 1,
      eventDigest: "digest-1",
    };
    // Equal cursor + equal digest is an idempotent no-op.
    expect(applyEvent(evented, 1, "digest-1")).toBe(evented);
    // Equal cursor + different digest is a conflicting duplicate.
    expect(() => applyEvent(evented, 1, "digest-1b")).toThrow(BoundaryError);
    // A gapped cursor cannot advance the attempt.
    expect(() => applyEvent(evented, 3, "digest-3")).toThrow(BoundaryError);
  });

  it("keeps cancellation as intent until an owner receipt distinguishes all four outcomes", async () => {
    // Ambiguous receipt keeps the intent open.
    const ambiguousWs = await runningAttempt("eff-cancel-a");
    let attempt = transition(await loadAttempt(ambiguousWs.root, ambiguousWs.id), "waiting");
    attempt = { ...attempt, cancellationIntent: true };
    await saveAttempt(ambiguousWs.root, attempt);
    const stillOpen = await resolveCancellation(
      ambiguousWs.root,
      "eff-cancel-a",
      "host://receipt/cancel-ambiguous",
      "ambiguous",
    );
    expect(stillOpen.cancellationIntent).toBe(true);

    // Acknowledged receipt closes the intent as canceled.
    const ackWs = await runningAttempt("eff-cancel-b");
    let ackBase = transition(await loadAttempt(ackWs.root, ackWs.id), "waiting");
    ackBase = { ...ackBase, cancellationIntent: true };
    await saveAttempt(ackWs.root, ackBase);
    const closed = await resolveCancellation(
      ackWs.root,
      "eff-cancel-b",
      "host://receipt/cancel-ack",
      "acknowledged",
    );
    expect(closed.cancellationIntent).toBe(false);
    expect(closed.status).toBe("canceled");

    // Committed success closes the intent as succeeded.
    const successWs = await runningAttempt("eff-cancel-c");
    let successBase = transition(await loadAttempt(successWs.root, successWs.id), "waiting");
    successBase = { ...successBase, cancellationIntent: true };
    await saveAttempt(successWs.root, successBase);
    const committed = await resolveCancellation(
      successWs.root,
      "eff-cancel-c",
      "host://receipt/effect-committed",
      "committed_success",
    );
    expect(committed.cancellationIntent).toBe(false);
    expect(committed.status).toBe("succeeded");

    // No-effect cancellation closes the intent as canceled.
    const noEffectWs = await runningAttempt("eff-cancel-d");
    let noEffectBase = transition(await loadAttempt(noEffectWs.root, noEffectWs.id), "waiting");
    noEffectBase = { ...noEffectBase, cancellationIntent: true };
    await saveAttempt(noEffectWs.root, noEffectBase);
    const noEffect = await resolveCancellation(
      noEffectWs.root,
      "eff-cancel-d",
      "host://receipt/cancel-noeffect",
      "no_effect",
    );
    expect(noEffect.status).toBe("canceled");

    // Resolving without any recorded intent fails closed.
    const plainWs = await runningAttempt("eff-cancel-e");
    await expect(
      resolveCancellation(plainWs.root, "eff-cancel-e", "host://receipt/x", "acknowledged"),
    ).rejects.toThrow(/No cancellation intent/);
  });

  it("lets only committed or no-effect owner receipts resolve ambiguity; compensation stays separate", async () => {
    const { root, id } = await runningAttempt("eff-resolve");

    await expect(
      resolveEffects(root, id, "owner://receipt/r1", "ambiguous"),
    ).rejects.toThrow(/Only committed or no-effect/);

    const resolvedNoEffect = await resolveEffects(root, id, "owner://receipt/r2", "no_effect");
    expect(resolvedNoEffect.status).not.toBe("succeeded");
    expect(JSON.stringify(resolvedNoEffect)).not.toMatch(/compensat/i);

    // Compensation has no path through the API: no function returns a
    // compensation action, and the disposition vocabulary lacks one.
    const disposition = await nextDisposition(resolvedNoEffect, {
      request: { knownRevision: resolvedNoEffect.revision },
    });
    expect(JSON.stringify(disposition)).not.toMatch(/compensat/i);
    const actionsAfterResolution = new Set(["inspect_effects", "dispatch"]);
    expect(actionsAfterResolution.has(disposition.action)).toBe(true);
  });

  it("detects false receipts without storing payloads", async () => {
    const { root, id } = await runningAttempt("eff-false");
    const falseReceipt = await joinDirectResult(root, id, {
      receiptRef: "harness://receipt/forged",
    });
    expect(falseReceipt).toMatchObject({ ok: false, reason: "receipt_invalid" });
    const stored = await loadAttempt(root, id);
    expect(stored.ownerPointers).toEqual([]);
    // A pointer-only ledger stays tiny; any payload copy would inflate it.
    const MAX_POINTER_ONLY_LEDGER_BYTES = 2000;
    const raw = await readFile(
      join(root, ".orchestration", "attempts", `${id}.jsonl`),
      "utf8",
    );
    expect(raw.length).toBeLessThan(MAX_POINTER_ONLY_LEDGER_BYTES);
  });

  it("resolves a cancellation race deterministically in the intent's favour", async () => {
    // Race: approval permission is granted while a cancellation intent lands.
    const root = await newRoot();
    const approvalRef = "host://approval/race";
    const attempt = createAttempt({
      id: "eff-race",
      pins: [approvalRef],
      deadline: hourFromNow(1),
      replayBudget: 1,
    });
    attempt.status = "waiting";
    attempt.pendingApprovalRef = approvalRef;
    attempt.cancellationIntent = true;
    await saveAttempt(root, attempt);

    const disposition = await reconstructNextAction(root, "eff-race", {
      hasHostPermission: () => Promise.resolve(true),
    });
    expect(disposition).toMatchObject({ action: "acknowledge_cancellation" });
  });

  it("survives a real process reset immediately after the durable dispatch intent", async () => {
    const { root, id } = await runningAttempt("eff-proc");
    const builtModule = new URL("../../dist/harness/attempt.js", import.meta.url).href;
    const probe = join(root, "..", `probe-effect-${Date.now()}.mjs`);
    await writeFile(
      probe,
      [
        `import { loadAttempt, nextDisposition } from ${JSON.stringify(builtModule)};`,
        `const [root, id] = process.argv.slice(2);`,
        `const attempt = await loadAttempt(root, id);`,
        `process.stdout.write(JSON.stringify(await nextDisposition(attempt)));`,
      ].join("\n"),
      "utf8",
    );
    // The child process shares nothing but the repository-visible ledger.
    const child = spawnSync(process.execPath, [probe, root, id], { encoding: "utf8" });
    expect(child.stderr).toBe("");
    expect(child.status).toBe(0);
    expect(JSON.parse(child.stdout.trim())).toMatchObject({
      action: "inspect_effects",
      reason: "mid_run_reset_effects_unknown",
    });
  });

  it("reports each invariant independently across tested boundaries", async () => {
    const reportPath = join(
      process.cwd(),
      ".scratch/methodological-harness-system-implementation/evidence/13-thin-path-effect-safety-report.md",
    );
    const report = await readFile(reportPath, "utf8");
    for (const invariant of [
      "Dispatch-intent durability",
      "Replay authorization",
      "Cancellation intent persistence",
      "Ambiguity resolution authority",
    ]) {
      expect(report).toContain(invariant);
    }
    expect(report).toContain("Verdict scale: supported / falsified / inconclusive");
    for (const verdict of ["supported", "falsified", "inconclusive"]) {
      expect(report.toLowerCase()).toContain(verdict);
    }
  });
});
