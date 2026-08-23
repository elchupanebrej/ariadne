import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MethodContract } from "../../src/method-contract/schemas.js";
import {
  BUILD_ORDER,
  createStageSequencer,
  normalize,
  runRound,
  SelfApplicationError,
  startRound,
  type RoundInputs,
} from "../../src/harness/self-application.js";
import { newRoot } from "./helpers.js";

const baseContract = (): MethodContract => ({
  format: "method-contract/1",
  id: "methodological-guide-authoring",
  version: "1.0.0-draft",
  status: "draft",
  guide: { href: "guide://designing-methodological-guides", role: "source" },
  artifacts: {
    A1: { id: "A1", role: "decision-record", schema: {}, rationale_ref: "R1" },
    A2: { id: "A2", role: "receipt", schema: {}, rationale_ref: "R2" },
  },
  rules: [
    { id: "rule-1", trigger: { target: "artifact.changed", schema: {} }, rationale_ref: "R1" },
    { id: "rule-2", trigger: { target: "before.complete", schema: {} }, rationale_ref: "R2" },
  ],
  completion_profiles: {
    default: { require_artifacts: ["A1"], require_receipts: ["A2"] },
    light: { require_artifacts: [], require_receipts: ["A2"] },
  },
  verification_hooks: [
    {
      id: "hook-1",
      on: "before.publish",
      check: "contract-meta-schema",
      owner: "method",
      rationale_ref: "R1",
    },
  ],
  lifecycle: {
    owner: "method",
    effective_date: "2026-08-01",
    change_log: [{ version: "1.0.0-draft", date: "2026-08-01", summary: "initial" }],
  },
});

const roundInputs = (round = 1, contract = baseContract()): RoundInputs => ({
  round,
  guideContent: "guide-body-v1",
  methodContract: contract,
  methodologySkillContent: "teach-methodology-skill-v1",
  harnessSkillContent: "teach-harness-skill-v1",
  kernelDispositionRef: "evidence/14-kernel-branch-disposition.md",
  kernelDispositionContent: "kernel-disposition: no kernel retained (ticket 14)",
});

const startedRound = async (round = 1) => {
  const root = await newRoot();
  await startRound(root, roundInputs(round));
  return root;
};

describe("staged self-application with fixed-point verification", () => {
  it("pins exact digests per input and never rewrites an active round's inputs", async () => {
    const root = await startedRound(1);
    const before = await readFile(join(root, "round-1", "inputs.json"), "utf8");

    const record = await runRound(root, 1);
    expect(record.pins.map((pin) => pin.id)).toEqual([
      "guide",
      "method-contract",
      "methodology-authoring",
      "harness-authoring",
      "kernel-disposition",
    ]);
    for (const pin of record.pins) {
      expect(pin.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(pin.version).toBeTruthy();
    }

    const after = await readFile(join(root, "round-1", "inputs.json"), "utf8");
    expect(after).toBe(before);

    await expect(startRound(root, roundInputs(1))).rejects.toThrow(/immutable/);
  });

  it("executes the declared build order and rejects out-of-order or repeated stages", async () => {
    const root = await startedRound(1);
    const record = await runRound(root, 1);
    expect(record.buildOrderExecuted).toEqual([...BUILD_ORDER]);

    const sequencer = createStageSequencer();
    sequencer.enter("guide");
    expect(() => sequencer.enter("guide")).toThrow(SelfApplicationError);
    const fresh = createStageSequencer();
    expect(() => fresh.enter("assessment-a")).toThrow(/Expected stage guide/);
    const unknown = createStageSequencer();
    expect(() => unknown.enter("kernel" as never)).toThrow(/Unknown stage/);
  });

  it("requires each assessor to emit complete artifacts, matrices, candidate, projection, and receipts", async () => {
    const root = await startedRound(1);
    const record = await runRound(root, 1);
    for (const assessment of record.assessments) {
      expect(assessment.artifacts).toContain("A1");
      expect(assessment.artifacts).toContain("audit");
      expect(assessment.artifacts).toContain("leave-one-out");
      expect(assessment.artifacts).toContain("change-propagation-matrix");
      expect(assessment.auditPassed).toBe(true);
      const byRemoved = Object.fromEntries(
        assessment.leaveOneOut.map((row) => [row.removedArtifactId, row.completionStillVerifiable]),
      );
      // Removing A1 kills every profile that needs it, but the light profile
      // stays verifiable; removing the receipt artifact A2 leaves none.
      expect(byRemoved["A1"]).toBe(true);
      expect(byRemoved["A2"]).toBe(false);
      expect(Object.keys(assessment.changePropagationMatrix)).toEqual(["rule-1", "rule-2"]);
      expect(assessment.changePropagationMatrix["rule-1"]).toContain("profiles:");
      expect(assessment.contractCandidate.format).toBe("method-contract/1");
      expect(assessment.normalizedProjection).toMatch(/^\{/);
      for (const required of ["pin", "completion", "independence", "noCircularValidation"]) {
        expect(assessment.receipts[required as keyof typeof assessment.receipts]).toBe(true);
      }
    }
    expect(record.assessments[0].assessorId).toBe("A");
    expect(record.assessments[1].assessorId).toBe("B");
    expect(record.assessments[0].workspace).not.toBe(record.assessments[1].workspace);
  });

  it("normalizes away only release-instance metadata, preserving order, predicates, rules, links", async () => {
    const contract = baseContract();
    const otherInstance = structuredClone(contract);
    otherInstance.lifecycle.effective_date = "2030-12-31";
    otherInstance.lifecycle.change_log = [
      { version: "1.0.0-draft", date: "2030-12-31", summary: "initial" },
    ];
    expect(normalize(otherInstance)).toBe(normalize(contract));

    // Rule order is executable order: swapping rules breaks equality.
    const reordered = structuredClone(contract);
    reordered.rules = [...reordered.rules].reverse();
    expect(normalize(reordered)).not.toBe(normalize(contract));

    // Predicates and normative links are preserved.
    const changedPredicate = structuredClone(contract);
    changedPredicate.completion_profiles.default.require_artifacts = ["A2"];
    expect(normalize(changedPredicate)).not.toBe(normalize(contract));

    const changedLink = structuredClone(contract);
    changedLink.rules[0].rationale_ref = "R9";
    expect(normalize(changedLink)).not.toBe(normalize(contract));
  });

  it("promotes only at the exact fixed point N(F_A(M)) = N(M) = N(F_B(M))", async () => {
    const root = await startedRound(1);
    const record = await runRound(root, 1);
    expect(record.fixedPoint.promoted).toBe(true);
    if (record.fixedPoint.promoted) {
      expect(record.fixedPoint.projection).toBe(normalize(baseContract()));
    }
    const rawA = JSON.stringify(record.assessments[0].contractCandidate);
    const rawB = JSON.stringify(record.assessments[1].contractCandidate);
    expect(rawA).not.toBe(rawB);
  });

  it("halts on assessor disagreement, pin drift, and starts a new immutable round for accepted deltas", async () => {
    // Assessor B derives a different rule: fixed point fails, round halts.
    const disagreeRoot = await startedRound(1);
    const divergent = await runRound(disagreeRoot, 1, {
      deriveB: (candidate) => {
        // B derives one extra well-formed rule backed by its own artifact.
        candidate.artifacts["A3"] = {
          id: "A3",
          role: "context-note",
          schema: {},
          rationale_ref: "R3",
        };
        candidate.rules.push({
          id: "rule-3",
          trigger: { target: "context.changed", schema: {} },
          rationale_ref: "R3",
        });
        return candidate;
      },
    });
    expect(divergent.fixedPoint).toMatchObject({ promoted: false });
    if (!divergent.fixedPoint.promoted) {
      expect(divergent.fixedPoint.deltas).toEqual(["N(F_B(M_1)) != N(M_1)"]);
    }

    // An accepted delta becomes a new immutable round with fresh pins.
    const nextContract = baseContract();
    nextContract.version = "1.0.1-draft";
    nextContract.artifacts["A3"] = {
      id: "A3",
      role: "context-note",
      schema: {},
      rationale_ref: "R3",
    };
    nextContract.rules.push({
      id: "rule-3",
      trigger: { target: "context.changed", schema: {} },
      rationale_ref: "R3",
    });
    const secondRoot = await newRoot();
    await startRound(secondRoot, roundInputs(2, nextContract));
    const promoted = await runRound(secondRoot, 2);
    expect(promoted.fixedPoint.promoted).toBe(true);
    await expect(startRound(secondRoot, roundInputs(2, nextContract))).rejects.toThrow(/immutable/);

    // Pin drift halts the round fail-closed.
    const driftRoot = await startedRound(3);
    const inputsFile = join(driftRoot, "round-3", "inputs.json");
    const original = JSON.parse(await readFile(inputsFile, "utf8")) as {
      inputs: RoundInputs;
    };
    const tampered = structuredClone(original);
    tampered.inputs.guideContent = "tampered-guide-body";
    await writeFile(inputsFile, `${JSON.stringify(tampered, null, 2)}\n`, "utf8");
    await expect(runRound(driftRoot, 3)).rejects.toThrow(/drifted/);
  });

  it("halts on an unresolved stop effect in the assessed contract", async () => {
    const root = await newRoot();
    const withStop = baseContract();
    withStop.rules[0].action = [{ kind: "stop", reason: "unresolved question" }];
    await startRound(root, roundInputs(4, withStop));
    await expect(runRound(root, 4)).rejects.toThrow(SelfApplicationError);
    let caught: SelfApplicationError | undefined;
    try {
      await runRound(root, 4);
    } catch (error) {
      caught = error as SelfApplicationError;
    }
    expect(caught?.reason).toBe("unresolved_stop");
  });

  it("pins declared owner versions and byte digests of the disposition file", async () => {
    const root = await newRoot();
    const inputs = roundInputs(5);
    const dispositionContent = "kernel-disposition: no kernel retained (ticket 14)";
    const started = {
      ...inputs,
      kernelDispositionRef: "evidence/14-kernel-branch-disposition.md",
      kernelDispositionContent: dispositionContent,
      inputVersions: {
        guide: "2.3.0",
        methodologyAuthoring: "1.4.0",
        harnessAuthoring: "0.9.0",
        kernelDisposition: "1.0.0",
      },
    };
    await startRound(root, started);
    const record = await runRound(root, 5);
    const byId = Object.fromEntries(record.pins.map((pin) => [pin.id, pin]));
    expect(byId["guide"]?.version).toBe("2.3.0");
    expect(byId["methodology-authoring"]?.version).toBe("1.4.0");
    expect(byId["harness-authoring"]?.version).toBe("0.9.0");
    // The disposition digest covers file bytes, not just the ref string.
    expect(byId["kernel-disposition"]?.digest).toBe(
      `sha256:${createHash("sha256").update(dispositionContent).digest("hex")}`,
    );
    expect(byId["kernel-disposition"]?.digest).not.toBe(
      `sha256:${createHash("sha256").update(started.kernelDispositionRef).digest("hex")}`,
    );
  });

  it("keeps structural self-consistency separate from teaching, adapter, kernel, recovery claims", async () => {
    const root = await startedRound(1);
    const record = await runRound(root, 1);
    const serialized = JSON.stringify(record);
    expect(serialized).not.toMatch(/"teaching[_-]?valid"/i);
    expect(serialized).not.toMatch(/"adapter[_-]?conformance"/i);
    expect(serialized).not.toMatch(/"kernel[_-]?necessity"/i);
    expect(serialized).not.toMatch(/"recovery[_-]?claim"/i);
    expect(record.assessments.every((a) => a.receipts.noCircularValidation)).toBe(true);
  });
});
