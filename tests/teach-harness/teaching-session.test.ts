import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HarnessTeachingSession,
  verifyHarnessProject,
  createDefaultHarnessProject,
  createThinBaselineHarnessProject,
  createDefaultHarnessDeclaredManifest,
} from "../../src/teach-harness/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Harness Authoring Teaching Skill — Issue 07", () => {
  describe("Outcome Requirements Defined Before Architecture", () => {
    it("requires starting with a meaningful task and pinning sources before defining outcomes", () => {
      const session = new HarnessTeachingSession();
      const outcomeResult = session.defineOutcomeRequirements();
      expect(outcomeResult.success).toBe(false);
      expect(outcomeResult.message).toMatch(/pin/i);
    });

    it("begins with repository-observable success, failure, waiting, and stop outcomes for continuation case", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      const result = session.defineOutcomeRequirements();

      expect(result.success).toBe(true);
      const state = session.getState();
      expect(state.phase).toBe("outcome_tests");
      expect(state.requirements.length).toBeGreaterThanOrEqual(5);

      const defaultProject = createDefaultHarnessProject();
      const reqs = defaultProject.outcome_requirements;
      expect(reqs.success_outcomes.length).toBeGreaterThanOrEqual(1);
      expect(reqs.failure_outcomes.length).toBeGreaterThanOrEqual(1);
      expect(reqs.waiting_outcomes.length).toBeGreaterThanOrEqual(1);
      expect(reqs.stop_outcomes.length).toBeGreaterThanOrEqual(1);
      expect(reqs.observable_fixtures.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Single Ownership and No Shadow State Enforcement", () => {
    it("assigns method, tracker, ariadne, host, and harness responsibilities to exactly one owner", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      const assignResult = session.assignOwnership();

      expect(assignResult.success).toBe(true);
      const state = session.getState();
      expect(state.ownersPlaced).toBe(true);

      const project = createDefaultHarnessProject();
      const owners = project.ownership_map;
      expect(owners.method.retained_responsibilities).toBeDefined();
      expect(owners.tracker.retained_responsibilities).toBeDefined();
      expect(owners.ariadne.retained_responsibilities).toBeDefined();
      expect(owners.host.retained_responsibilities).toBeDefined();
      expect(owners.orchestration_harness.retained_responsibilities).toBeDefined();

      // Prohibits shadow state in orchestration harness
      expect(
        owners.orchestration_harness.prohibited_responsibilities.some((r) =>
          /copying|shadow/i.test(r),
        ),
      ).toBe(true);
    });

    it("rejects completion when shadow owner state is injected into harness", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();
      session.testBaseline();
      session.selectCandidate("minimal neutral kernel");
      session.applyTriggeredMechanisms();
      session.defineArtifactContract();
      session.injectAmbiguousEffect();
      session.recoverAmbiguousEffect();
      session.evaluateLifecycleFixtures();
      session.recordLifecycleGuidance();
      session.answerSelfExplanation();
      session.completeFadedCase();
      session.routeTransferCase();

      session.injectShadowState();
      const gateResult = session.attemptCompletion();
      expect(gateResult.passed).toBe(false);
      expect(gateResult.status).toBe("rejected");
      expect(gateResult.blockers.some((b) => /shadow|copied/i.test(b))).toBe(true);
    });
  });

  describe("Non-Compensatory Candidate Filtering", () => {
    it("measures the thin baseline first and discovers continuation failure for cross-session task", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();

      const baselineResult = session.testBaseline();
      expect(baselineResult.success).toBe(true);
      expect(baselineResult.failures).toContain("mid-run resume");
      expect(baselineResult.failures).toContain("ambiguous side effect");

      const selectResult = session.selectCandidate();
      expect(selectResult.success).toBe(true);
      expect(session.getState().candidate).toBe("minimal neutral kernel");
    });

    it("evaluates candidates non-compensatorily where one failed invariant eliminates eligibility", () => {
      const project = createDefaultHarnessProject();
      const evals = project.candidate_selection.evaluations;

      const thin = evals.find((e) => e.candidate_name === "thin_baseline");
      const host = evals.find((e) => e.candidate_name === "host_plugin");
      const kernel = evals.find((e) => e.candidate_name === "minimal_neutral_kernel");

      expect(thin?.status).toBe("ineligible");
      expect(host?.status).toBe("ineligible");
      expect(kernel?.status).toBe("provisionally_retained");
    });
  });

  describe("Pointer-Only Artifact Contract and Approval Waiting", () => {
    it("defines pointer-only context, attempt cursor, artifact envelopes, and events without copied payloads", () => {
      const project = createDefaultHarnessProject();
      const ac = project.artifact_contract;
      expect(ac).toBeDefined();
      if (!ac) return;

      expect(ac.context_manifest.length).toBeGreaterThanOrEqual(3);
      for (const ptr of ac.context_manifest) {
        expect(ptr.pointer_id).toBeDefined();
        expect(ptr.digest).toBeDefined();
        expect(ptr.owner).toBeDefined();
        expect(ptr.target_uri).toBeDefined();
      }

      expect(ac.attempt_cursor.status).toBe("waiting");
      expect(ac.attempt_cursor.idempotency_key).toBeDefined();
      expect(ac.attempt_cursor.pending_action_pointers.length).toBeGreaterThanOrEqual(1);

      expect(ac.host_adapter.capabilities.supports_native_approvals).toBe(true);
      expect(ac.host_adapter.capabilities.supports_resume).toBe(true);
    });
  });

  describe("Ambiguous Side Effect and Recovery Without Duplicate Replay", () => {
    it("enters waiting on ambiguous side effect and recovers only via owner inspection receipt without duplicate replay", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();
      session.testBaseline();
      session.selectCandidate("minimal neutral kernel");
      session.applyTriggeredMechanisms();
      session.defineArtifactContract();

      const injectResult = session.injectAmbiguousEffect();
      expect(injectResult.success).toBe(true);
      expect(session.getState().phase).toBe("waiting_for_inspection");

      const recoverResult = session.recoverAmbiguousEffect({
        receiptId: "RECEIPT-owner-pr-inspection",
        ownerVerification: "PR #42 confirmed published; receipt attached to attempt",
      });
      expect(recoverResult.success).toBe(true);
      expect(session.getState().recoveryPracticed).toBe(true);
      expect(session.getState().ambiguousEffect).toBe(false);
    });

    it("rejects completion when duplicate replay is attempted without inspection receipt", () => {
      const session = new HarnessTeachingSession();
      session.startTask("cross-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();
      session.testBaseline();
      session.selectCandidate("minimal neutral kernel");
      session.applyTriggeredMechanisms();
      session.defineArtifactContract();
      session.injectAmbiguousEffect();
      session.injectDuplicateReplay();
      session.evaluateLifecycleFixtures();
      session.recordLifecycleGuidance();
      session.answerSelfExplanation();
      session.completeFadedCase();
      session.routeTransferCase();

      const gateResult = session.attemptCompletion();
      expect(gateResult.passed).toBe(false);
      expect(gateResult.status).toBe("rejected");
      expect(gateResult.blockers.some((b) => /replay|duplicate/i.test(b))).toBe(true);
    });
  });

  describe("Passing Thin Baseline Produces Valid No-Kernel (Trimmed) Result", () => {
    it("completes with trimmed status when single-session baseline satisfies all requirements", () => {
      const session = new HarnessTeachingSession();
      session.startTask("single-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();

      const baselineResult = session.testBaseline();
      expect(baselineResult.success).toBe(true);
      expect(baselineResult.failures.length).toBe(0);

      session.selectCandidate("thin baseline");
      session.applyTriggeredMechanisms([]);
      session.defineArtifactContract();
      session.evaluateLifecycleFixtures();
      session.recordLifecycleGuidance();
      session.answerSelfExplanation();
      session.completeFadedCase();
      session.routeTransferCase();

      const gateResult = session.attemptCompletion();
      expect(gateResult.passed).toBe(true);
      expect(gateResult.status).toBe("trimmed");
    });

    it("verifies thin baseline project bundle validity", () => {
      const thinProject = createThinBaselineHarnessProject();
      const verification = verifyHarnessProject(thinProject);
      expect(verification.valid).toBe(true);
      expect(thinProject.status).toBe("trimmed");
      expect(thinProject.candidate_selection.selected_candidate).toBe("thin_baseline");
      expect(thinProject.triggered_mechanisms.length).toBe(0);
    });
  });

  describe("Prototype 6-Path Deterministic Invariant Check", () => {
    it("passes all 6 deterministic scenario paths matching the prototype specification", () => {
      const session = new HarnessTeachingSession();
      const selfCheckResult = session.runPrototypeSelfCheck();
      expect(selfCheckResult.passed).toBe(true);
      expect(selfCheckResult.pathsPassed).toBe(6);
      expect(selfCheckResult.message).toContain("6 deterministic paths passed");
    });
  });

  describe("Package Artifacts and Runnable Completion Check", () => {
    it("validates that package files exist and pass verification", () => {
      const skillDir = resolve(__dirname, "../../.agents/skills/teach-harness");
      expect(existsSync(resolve(skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(resolve(skillDir, "references/harness-research.md"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/README.md"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/input/dependency-review-run.json"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/solution/harness-project.json"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/check.mjs"))).toBe(true);

      const projectJson = JSON.parse(
        readFileSync(resolve(skillDir, "example/solution/harness-project.json"), "utf-8"),
      );
      const verificationResult = verifyHarnessProject(projectJson);
      expect(verificationResult.valid).toBe(true);
    });
  });
});
