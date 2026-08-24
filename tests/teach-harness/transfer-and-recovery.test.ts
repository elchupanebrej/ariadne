import { describe, expect, it } from "vitest";
import {
  HarnessTeachingSession,
  createDefaultHarnessProject,
  createIssueTriageDeclaredManifest,
  createIssueTriageHarnessProject,
  createStagedSelfApplicationDeclaredManifest,
  createStagedSelfApplicationHarnessProject,
  createThinBaselineHarnessProject,
  verifyHarnessProject,
} from "../../src/teach-harness/index.js";
import type { HarnessProject } from "../../src/teach-harness/types.js";

describe("Verify Harness Transfer, Fading, Recovery, and Deletion Discipline (Ticket 08)", () => {
  function createAndPassWorkedExample(): HarnessTeachingSession {
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
    session.recoverAmbiguousEffect({
      receiptId: "RECEIPT-owner-pr-inspection",
      ownerVerification: "PR #42 confirmed published; receipt attached to attempt",
    });
    session.evaluateLifecycleFixtures();
    session.recordLifecycleGuidance();
    session.answerSelfExplanation({
      q1_ownership_boundary: "Harness retains pointer-only ledger; method, tracker, ariadne, host, and humans own their domain data.",
      q2_observed_triggers: "Each mechanism is linked to a concrete observed failure (resume, approval, replay, drift).",
      q3_ambiguous_recovery: "Crash after external side effect halts retries and awaits owner inspection receipt.",
      q4_trace_correlation: "Normalized events carry run_id, attempt, step_ref, and host trace correlation.",
      q5_baseline_deletion: "If thin baseline satisfies all hard invariants, the kernel is deleted/trimmed.",
    });
    return session;
  }

  describe("Slice 1: Faded Issue-Triage Continuation Case & Observed Mechanism Selection", () => {
    it("creates a complete schema-valid issue-triage harness project selecting only mechanisms linked to observed lifecycle failures", () => {
      const project = createIssueTriageHarnessProject();
      const result = verifyHarnessProject(project);

      expect(result.valid).toBe(true);
      expect(project.id).toBe("issue-triage-continuation-harness");
      expect(project.status).toBe("active");
      expect(project.candidate_selection.selected_candidate).toBe("minimal_neutral_kernel");

      // Verify that mechanisms are linked to observed issue-triage continuation failures
      expect(project.triggered_mechanisms.length).toBeGreaterThanOrEqual(4);
      expect(
        project.triggered_mechanisms.some((m) =>
          m.smallest_mechanism_added.includes("attempt cursor"),
        ),
      ).toBe(true);
      expect(
        project.triggered_mechanisms.some((m) =>
          m.smallest_mechanism_added.includes("pending approval pointer"),
        ),
      ).toBe(true);
      expect(
        project.triggered_mechanisms.some((m) =>
          m.smallest_mechanism_added.includes("context manifest"),
        ),
      ).toBe(true);
      expect(
        project.triggered_mechanisms.some((m) =>
          m.smallest_mechanism_added.includes("artifact and receipt gates"),
        ),
      ).toBe(true);

      // Verify outcome requirements for issue triage
      const outcomes = project.outcome_requirements;
      expect(outcomes.success_outcomes.some((o) => /triage|issue/i.test(o))).toBe(true);
      expect(outcomes.waiting_outcomes.some((o) => /human|triage|maintainer/i.test(o))).toBe(true);
    });

    it("completes faded case with less guidance in session and records faded project", () => {
      const session = createAndPassWorkedExample();
      const result = session.completeFadedCase();

      expect(result.success).toBe(true);
      const state = session.getState();
      expect(state.fadedCase).toBe(true);
      expect(state.phase).toBe("faded_practice");
      expect(state.fadedProject).toBeDefined();
      expect(state.fadedProject?.id).toBe("issue-triage-continuation-harness");
    });

    it("rejects completing faded case if self-explanation has not been submitted", () => {
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

      const result = session.completeFadedCase();
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/explain/i);
    });

    it("rejects invalid faded case project when required fields are missing", () => {
      const session = createAndPassWorkedExample();
      const valid = createIssueTriageHarnessProject();
      const { source_pins: _removed, ...projectWithoutPins } = valid;
      const invalidProject = projectWithoutPins as Partial<HarnessProject>;

      const result = session.completeFadedCase(invalidProject);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/validation failed/i);
    });
  });

  describe("Slice 2: Staged-Self-Application Transfer Case (Acyclicity & No Runtime Recursion)", () => {
    it("creates valid staged-self-application harness project preserving acyclic build-time boundary", () => {
      const project = createStagedSelfApplicationHarnessProject();
      const result = verifyHarnessProject(project);

      expect(result.valid).toBe(true);
      expect(project.id).toBe("staged-self-application-harness");
      expect(project.staged_self_application?.build_time_input).toBe(true);
      expect(project.staged_self_application?.coordinates_two_applications).toBe(true);
      expect(project.staged_self_application?.self_invocation_prohibited).toBe(true);
      expect(project.staged_self_application?.runtime_recursion_prohibited).toBe(true);
    });

    it("routes staged self-application transfer without active builder self-invocation or runtime recursion", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase();
      expect(result.success).toBe(true);

      const state = session.getState();
      expect(state.transferCase).toBe(true);
      expect(state.acyclicityVerified).toBe(true);
      expect(state.selfInvocationDetected).toBe(false);
      expect(state.runtimeRecursionDetected).toBe(false);
      expect(state.phase).toBe("staged_transfer");
      expect(state.transferProject).toBeDefined();
      expect(state.transferProject?.id).toBe("staged-self-application-harness");
    });

    it("fails closed and rejects transfer when self-invocation is attempted", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase({ allowSelfInvocation: true });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/acyclicity|self-invocation/i);

      const state = session.getState();
      expect(state.selfInvocationDetected).toBe(true);
      expect(state.phase).toBe("blocked");

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => /self-invocation|builder/i.test(b))).toBe(true);
    });

    it("fails closed and rejects transfer when runtime recursion is attempted", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase({ allowRuntimeRecursion: true });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/acyclicity|recursion/i);

      const state = session.getState();
      expect(state.runtimeRecursionDetected).toBe(true);
      expect(state.phase).toBe("blocked");

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => /recursion|active/i.test(b))).toBe(true);
    });
  });

  describe("Slice 3: Targeted Recovery at Affected Boundaries", () => {
    it("handles pin mismatch and recovers precisely via repairPin while preserving existing state", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      // Record pin mismatch fault
      session.recordFault(
        "pin_mismatch",
        "Method contract pin digest mismatched during validation check",
      );

      expect(session.getState().pins).toBe(false);
      expect(session.getState().phase).toBe("blocked");

      // Targeted recovery
      const repair = session.repairPin({
        contractVersion: "1.0.0-draft",
        contractDigest: "sha256:methodological-guide-authoring-v1",
      });

      expect(repair.recovered).toBe(true);
      expect(session.getState().pins).toBe(true);
    });

    it("handles invalid pointer failure and repairs context pointer in place via repairPointer", () => {
      const session = createAndPassWorkedExample();

      session.recordFault(
        "invalid_pointer",
        "Context manifest pointer CTX-001 target URI unreachable or digest corrupted",
        "CTX-001-guide",
      );

      expect(session.getState().phase).toBe("blocked");

      const repair = session.repairPointer("CTX-001-guide", {
        target_uri: "file://docs/designing_methodological_guides.md",
        digest: "sha256:designing-methodological-guides-v1",
      });

      expect(repair.recovered).toBe(true);
      expect(session.getState().phase).not.toBe("blocked");
    });

    it("handles ownership conflict (shadow state) and repairs boundary in place via repairOwnership", () => {
      const session = createAndPassWorkedExample();

      session.recordFault(
        "ownership_conflict",
        "Harness ledger attempted to store copies of Ariadne claims and tracker status",
        "orchestration_harness",
      );

      expect(session.getState().shadowState).toBe(true);
      expect(session.getState().phase).toBe("blocked");

      const repair = session.repairOwnership("orchestration_harness", [
        "Repository-visible attempt cursor and run lifecycle",
        "Source, skill, adapter, and workspace pin validation",
        "Ordered content-addressed context manifest pointers",
        "Generic artifact and owner-receipt gates",
      ]);

      expect(repair.recovered).toBe(true);
      expect(session.getState().shadowState).toBe(false);
    });

    it("handles ambiguous side effect and recovers safely via recoverAmbiguousEffect with owner receipt", () => {
      const session = createAndPassWorkedExample();

      session.recordFault(
        "ambiguous_side_effect",
        "Process loss occurred after review publication before receipt write",
      );

      expect(session.getState().ambiguousEffect).toBe(true);
      expect(session.getState().phase).toBe("waiting_for_inspection");

      const recovery = session.recoverAmbiguousEffect({
        receiptId: "RECEIPT-owner-pr-inspection-42",
        ownerVerification: "Verified remote publication succeeded; attached receipt to attempt",
      });

      expect(recovery.success).toBe(true);
      expect(session.getState().ambiguousEffect).toBe(false);
      expect(session.getState().recoveryPracticed).toBe(true);
    });

    it("handles unsupported capability deficit and recovers via repairCapability", () => {
      const session = createAndPassWorkedExample();

      session.recordFault(
        "unsupported_capability",
        "Host adapter failed to support native approval workflow required for security gate",
        "host-adapter-standard-v1",
      );

      expect(session.getState().phase).toBe("blocked");

      const repair = session.repairCapability("host-adapter-standard-v1", {
        supports_native_approvals: true,
        supports_resume: true,
      });

      expect(repair.recovered).toBe(true);
      expect(session.getState().phase).not.toBe("blocked");
    });

    it("handles runtime recursion fault and recovers via repairRuntimeRecursion", () => {
      const session = createAndPassWorkedExample();

      session.recordFault(
        "runtime_recursion",
        "Orchestration kernel configured to invoke teaching skill builder during self-application",
      );

      expect(session.getState().runtimeRecursion).toBe(true);
      expect(session.getState().phase).toBe("blocked");

      const repair = session.repairRuntimeRecursion();
      expect(repair.recovered).toBe(true);
      expect(session.getState().runtimeRecursion).toBe(false);
      expect(session.getState().runtimeRecursionDetected).toBe(false);
    });
  });

  describe("Slice 4: Single Ownership, Observed Triggers & Executable Necessity Criteria", () => {
    it("verifies every retained mechanism has one owner, one observed trigger, and one executable necessity criterion", () => {
      const project = createDefaultHarnessProject();
      const verification = verifyHarnessProject(project);
      expect(verification.valid).toBe(true);

      for (const m of project.triggered_mechanisms) {
        expect(m.observable_condition).toBeDefined();
        expect(m.observable_condition.length).toBeGreaterThan(0);
        expect(m.smallest_mechanism_added).toBeDefined();
        expect(m.smallest_mechanism_added.length).toBeGreaterThan(0);
        expect(m.trigger_observed).toBe(true);
        expect(m.necessity_criterion).toBeDefined();
        expect(m.necessity_criterion.length).toBeGreaterThan(0);
        expect(m.owner).toBeDefined();
      }
    });

    it("rejects mechanisms that lack observed triggers or necessity criteria", () => {
      const project = createDefaultHarnessProject();
      project.triggered_mechanisms.push({
        observable_condition: "Speculative distributed lock for unobserved remote cluster",
        smallest_mechanism_added: "distributed-lock-service",
        trigger_observed: false,
        necessity_criterion: "",
      });

      const verification = verifyHarnessProject(project);
      expect(verification.valid).toBe(false);
      expect(verification.problems.some((p) => /observed trigger|necessity criterion/i.test(p))).toBe(true);
    });
  });

  describe("Slice 5: Matched Run Audit Trail & Clean-Session Comparison Arm", () => {
    it("emits complete run report with 0 prohibited inputs and 0 interventions for clean session", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      const report = session.getRunReport();
      expect(report.taskId).toBe("dependency-review-continuation-harness");
      expect(report.declaredInputs.length).toBeGreaterThanOrEqual(4);
      expect(report.prohibitedInputs).toEqual([]);
      expect(report.interventions).toEqual([]);
      expect(report.routeChoices).toContain(".agents/skills/methodize-harness/SKILL.md");
      expect(report.routeChoices).toContain("references/harness-research.md");
      expect(report.receipts.length).toBeGreaterThanOrEqual(1);

      // Verify comparison arms share identical task, sources, capabilities, and critical criteria
      expect(report.comparisonArms).toBeDefined();
      expect(report.comparisonArms.teaching_skill_arm.taskId).toBe(report.comparisonArms.thin_baseline_arm.taskId);
      expect(report.comparisonArms.teaching_skill_arm.sourcePins).toEqual(report.comparisonArms.thin_baseline_arm.sourcePins);
      expect(report.comparisonArms.teaching_skill_arm.capabilities).toEqual(report.comparisonArms.thin_baseline_arm.capabilities);
      expect(report.comparisonArms.teaching_skill_arm.criticalCriteria).toEqual(report.comparisonArms.thin_baseline_arm.criticalCriteria);
    });

    it("records prohibited inputs and interventions when detected or logged", () => {
      const session = new HarnessTeachingSession();
      session.detectProhibitedInput("shadow-state-copy");
      session.recordIntervention("Author intervened to explain attempt cursor structure");

      const report = session.getRunReport();
      expect(report.prohibitedInputs).toContain("shadow-state-copy");
      expect(report.interventions).toContain("Author intervened to explain attempt cursor structure");
    });
  });

  describe("Slice 6: Deletion Discipline & Independent Multi-Claim Evaluation Reporting", () => {
    it("deletes/inlines kernel mechanisms when thin baseline passes all hard invariants (status: trimmed)", () => {
      const session = new HarnessTeachingSession();
      session.startTask("single-session");
      session.pinSources();
      session.defineOutcomeRequirements();
      session.assignOwnership();
      session.testBaseline();
      session.selectCandidate("thin baseline");
      session.applyTriggeredMechanisms([]);
      session.defineArtifactContract();
      session.evaluateLifecycleFixtures();
      session.recordLifecycleGuidance();
      session.answerSelfExplanation();
      session.completeFadedCase();
      session.routeTransferCase();

      const result = session.attemptCompletion();
      expect(result.passed).toBe(true);
      expect(result.status).toBe("trimmed");

      const claims = session.getClaimsReport();
      expect(claims.claims.deletion_discipline.status).toBe("SUPPORTED");
      expect(claims.claims.deletion_discipline.evidence).toContain("Kernel mechanisms trimmed to 0");
    });

    it("reports faded performance, structural transfer, targeted recovery, mechanism necessity, and deletion discipline as separate claims", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      // Clean run without injected faults: recovery is INCONCLUSIVE while overall passes
      const cleanClaims = session.getClaimsReport();
      expect(cleanClaims.overallPassed).toBe(true);
      expect(cleanClaims.claims.faded_performance.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.structural_transfer.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.mechanism_necessity.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.deletion_discipline.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.targeted_recovery.status).toBe("INCONCLUSIVE");

      // Inject and resolve faults
      session.recordFault("pin_mismatch", "Unpinned contract");
      session.repairPin();
      session.recordFault("invalid_pointer", "Corrupt pointer", "CTX-001");
      session.repairPointer("CTX-001", { target_uri: "file://repaired", digest: "sha256:repaired" });
      session.recordFault("ownership_conflict", "Shadow state", "orchestration_harness");
      session.repairOwnership("orchestration_harness", ["retained responsibility"]);
      session.recordFault("ambiguous_side_effect", "Process loss");
      session.recoverAmbiguousEffect({ receiptId: "R-1", ownerVerification: "verified" });
      session.recordFault("unsupported_capability", "Capability deficit", "adapter");
      session.repairCapability("adapter", { supports_native_approvals: true });
      session.recordFault("runtime_recursion", "Recursion");
      session.repairRuntimeRecursion();

      const exercisedClaims = session.getClaimsReport();
      expect(exercisedClaims.overallPassed).toBe(true);
      expect(exercisedClaims.claims.targeted_recovery.status).toBe("SUPPORTED");
      expect(exercisedClaims.claims.targeted_recovery.evidence).toContain("All 6 injected fault(s) resolved");
    });

    it("enforces non-compensatory scoring: uncompleted faded case does not pass overall evaluation", () => {
      const session = createAndPassWorkedExample();
      // Faded case and transfer NOT completed yet

      const claims = session.getClaimsReport();
      expect(claims.overallPassed).toBe(false);
      expect(claims.claims.faded_performance.status).toBe("FALSIFIED");
      expect(claims.claims.structural_transfer.status).toBe("FALSIFIED");
    });

    it("fails targeted recovery claim when unresolved faults remain", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      session.recordFault("invalid_pointer", "Unresolved corrupted pointer in context manifest");
      const claims = session.getClaimsReport();
      expect(claims.overallPassed).toBe(false);
      expect(claims.claims.targeted_recovery.status).toBe("FALSIFIED");
      expect(claims.claims.targeted_recovery.evidence).toContain("1/1 fault(s) remain unresolved");
    });
  });
});
