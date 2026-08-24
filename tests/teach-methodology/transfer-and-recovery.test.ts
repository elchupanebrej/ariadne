import { describe, expect, it } from "vitest";
import {
  MethodologyTeachingSession,
  createDefaultGuideProject,
  createIncidentHandoffGuideProject,
  createMetamethodologicalGuideProject,
  verifyGuideProject,
} from "../../src/teach-methodology/index.js";
import type { GuideProject } from "../../src/teach-methodology/types.js";

describe("Verify Guide Transfer, Fading, and Recovery (Ticket 06)", () => {
  function createAndPassWorkedExample(): MethodologyTeachingSession {
    const session = new MethodologyTeachingSession();
    session.startTask();
    session.pinContract({
      version: "1.0.0-draft",
      digest: "sha256:methodological-guide-authoring-v1",
      profile: "evidence_focused",
    });
    session.draftA0();
    for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
      session.expandArtifact(id);
    }
    session.resolveRationaleLinks();
    session.recordExternalVerification({
      expert_review: "passed-by-domain-expert",
      novice_execution: "passed-independent-novice-run",
      repository_pilot: "passed-pilot-receipt",
    });
    session.submitSelfExplanation({
      q1_expansion_signals: "Signals such as purpose sprawl, split authority, and branching require specialized A1-A7 cards.",
      q2_concise_a0: "A0 serves as the concise working map rather than duplicating deep domain details.",
      q3_non_synthesized_authority: "Novices and unprivileged roles cannot synthesize policy waiver or unilateral closure authority.",
      q4_receipt_separation: "Self-consistency cannot substitute for external user verification.",
      q5_targeted_recovery: "Targeted recovery re-runs affected hooks instead of full rebuilds.",
    });
    return session;
  }

  describe("Slice 1: Faded Incident-Handoff Case & Complete A0–A7 Generation", () => {
    it("creates a complete schema-valid incident-handoff guide project with all triggered A0–A7 artifacts", () => {
      const project = createIncidentHandoffGuideProject();
      const result = verifyGuideProject(project);

      expect(result.valid).toBe(true);
      expect(project.id).toBe("incident-shift-handoff-guide");
      expect(project.contract_pin.profile).toBe("evidence_focused");

      // Verify A0 contains all required fields and 7 expansion signals
      const a0 = project.artifacts.A0;
      expect(a0.user_and_situation).toContain("on-call engineer");
      expect(a0.action).toContain("Synchronize incident timeline");
      expect(a0.learning_path).toBeDefined();
      expect(a0.verification).toBeDefined();
      expect(a0.rationale_and_unknowns).toBeDefined();
      expect(a0.next_step).toBeDefined();
      expect(Object.keys(a0.expansion_signals || {}).length).toBe(7);

      // Verify A1 through A7
      expect(project.artifacts.A1.problem).toContain("Shift rotations");
      expect(project.artifacts.A2.claims.length).toBeGreaterThanOrEqual(3);
      expect(project.artifacts.A3.roles.outgoing_oncall).toBeDefined();
      expect(project.artifacts.A3.roles.incoming_oncall).toBeDefined();
      expect(project.artifacts.A3.roles.incident_commander).toBeDefined();
      expect(project.artifacts.A4.rules.length).toBeGreaterThanOrEqual(3);
      expect(project.artifacts.A5.meaningful_task).toBeDefined();
      expect(project.artifacts.A6.hypotheses).toBeDefined();
      expect(project.artifacts.A7.ownership).toBeDefined();
    });

    it("completes faded case with less guidance in session and records faded project", () => {
      const session = createAndPassWorkedExample();
      const result = session.completeFadedCase();

      expect(result.success).toBe(true);
      const state = session.getState();
      expect(state.fadedCase).toBe(true);
      expect(state.phase).toBe("faded_practice");
      expect(state.fadedProject).toBeDefined();
      expect(state.fadedProject?.id).toBe("incident-shift-handoff-guide");
    });

    it("rejects completing faded case if self-explanation has not been submitted", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      session.draftA0();
      for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
        session.expandArtifact(id);
      }
      session.resolveRationaleLinks();
      session.recordExternalVerification();

      const result = session.completeFadedCase();
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/explain/i);
    });

    it("rejects invalid faded case project when required fields are missing", () => {
      const session = createAndPassWorkedExample();
      const valid = createIncidentHandoffGuideProject();
      const { A0: _removed, ...artifactsWithoutA0 } = valid.artifacts;
      const invalidProject: Record<string, unknown> = {
        ...valid,
        artifacts: artifactsWithoutA0,
      };

      const result = session.completeFadedCase(invalidProject as Partial<GuideProject>);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/validation failed/i);
    });
  });

  describe("Slice 2: Metamethodological Transfer Case (Acyclicity & No Runtime Recursion)", () => {
    it("creates valid metamethodological guide project with acyclicity metadata and separate self-consistency receipts", () => {
      const project = createMetamethodologicalGuideProject();
      const result = verifyGuideProject(project);

      expect(result.valid).toBe(true);
      expect(project.id).toBe("metamethodology-authoring-guide");
      expect(project.contract_pin.profile).toBe("metamethodological");
      expect(project.acyclicity_metadata?.self_invocation).toBe(false);
      expect(project.acyclicity_metadata?.active_rewriting).toBe(false);
      expect(project.acyclicity_metadata?.build_time_input).toBe(true);

      // Verify separate self-consistency receipts
      expect(project.receipts?.self_consistency).toBeDefined();
      expect(project.receipts?.external_verification).toBeUndefined();
    });

    it("routes metamethodological transfer without active builder self-invocation or rewriting", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase();
      expect(result.success).toBe(true);

      const state = session.getState();
      expect(state.transferCase).toBe(true);
      expect(state.selfConsistencyReceipt).toBe(true);
      expect(state.selfConsistencySeparated).toBe(true);
      expect(state.acyclicityVerified).toBe(true);
      expect(state.selfInvocationDetected).toBe(false);
      expect(state.activeRewritingDetected).toBe(false);
      expect(state.phase).toBe("metamethodological_transfer");
    });

    it("fails closed and rejects transfer when self-invocation is attempted", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase({ allowSelfInvocation: true });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/acyclicity violation/i);

      const state = session.getState();
      expect(state.selfInvocationDetected).toBe(true);
      expect(state.phase).toBe("blocked");

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => b.includes("self-invocation"))).toBe(true);
    });

    it("fails closed and rejects transfer when active source rewriting is attempted", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      const result = session.routeTransferCase({ allowActiveRewriting: true });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/acyclicity violation/i);

      const state = session.getState();
      expect(state.activeRewritingDetected).toBe(true);
      expect(state.phase).toBe("blocked");

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => b.includes("active rewriting"))).toBe(true);
    });
  });

  describe("Slice 3: Targeted Recovery at Affected Boundaries", () => {
    it("handles pin failure and recovers precisely via repairPin while preserving existing artifacts", () => {
      const session = createAndPassWorkedExample();
      const initialArtifactKeys = Object.keys(session.getState().artifacts);
      expect(initialArtifactKeys.length).toBe(8);

      // Fault 1: pin failure
      session.recordFault(
        "pin_failure",
        "Method contract pin dropped or digest mismatched during validation check",
      );

      expect(session.getState().contractPinned).toBe(false);
      expect(session.getState().phase).toBe("blocked");

      // Targeted recovery
      const repair = session.repairPin({
        version: "1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        profile: "evidence_focused",
      });

      expect(repair.recovered).toBe(true);
      expect(session.getState().contractPinned).toBe(true);
      expect(Object.keys(session.getState().artifacts)).toEqual(initialArtifactKeys);
    });

    it("handles invalid artifact failure and repairs it in place via repairArtifact", () => {
      const session = createAndPassWorkedExample();
      const initialArtifactKeys = Object.keys(session.getState().artifacts);

      // Fault 2: invalid artifact
      session.recordFault(
        "invalid_artifact",
        "Artifact A2 corrupted with empty claims list",
        "A2",
      );

      expect(session.getState().phase).toBe("blocked");

      // Targeted recovery
      const defaultA2 = createDefaultGuideProject().artifacts.A2;
      const repair = session.repairArtifact("A2", defaultA2);

      expect(repair.recovered).toBe(true);
      expect(repair.preservedArtifacts).toEqual(initialArtifactKeys);
      expect(session.getState().artifacts.A2).toBeDefined();
    });

    it("handles broken rationale anchor and recovers via repairRationaleLink", () => {
      const session = createAndPassWorkedExample();

      // Fault 3: rationale link failure
      session.recordFault(
        "rationale_failure",
        "A2 claim references non-existent anchor #unknown-heading",
        "A2:CLAIM-verify-repository",
      );

      expect(session.getState().brokenLink).toBe(true);
      expect(session.getState().phase).toBe("blocked");

      // Targeted recovery
      const repair = session.repairRationaleLink();
      expect(repair.recovered).toBe(true);
      expect(session.getState().brokenLink).toBe(false);
    });

    it("handles synthesized unauthorized authority and recovers via repairAuthority", () => {
      const session = createAndPassWorkedExample();

      // Fault 4: unauthorized authority synthesized
      session.recordFault(
        "authority_failure",
        "Novice reviewer was granted waive_policy capability",
        "novice_reviewer",
      );

      expect(session.getState().phase).toBe("blocked");
      const a3 = session.getState().artifacts.A3 as import("../../src/teach-methodology/types.js").A3UserMap;
      expect(a3.roles.novice_reviewer.authority).toContain("waive_policy");

      // Targeted recovery
      const repair = session.repairAuthority("novice_reviewer", [
        "gather_inputs",
        "run_checks",
        "record_disposition",
      ]);

      expect(repair.recovered).toBe(true);
      expect(repair.allowedAuthorities).not.toContain("waive_policy");
      expect(session.getState().phase).toBe("explained");
    });

    it("handles circularity failure and recovers via repairCircularity", () => {
      const session = createAndPassWorkedExample();

      // Fault 5: circular proof substitution
      session.recordFault(
        "circularity_failure",
        "Self-consistency receipt was substituted for external novice execution receipt",
      );

      expect(session.getState().circularProof).toBe(true);
      expect(session.getState().phase).toBe("blocked");

      // Targeted recovery
      const repair = session.repairCircularity();
      expect(repair.recovered).toBe(true);
      expect(session.getState().circularProof).toBe(false);
      expect(session.getState().selfConsistencySeparated).toBe(true);
    });
  });

  describe("Slice 4: Version, Ownership, Feedback, Deviation, and Retirement Provenance", () => {
    it("validates lifecycle log provenance in A7 for both ordinary and metamethodological guides", () => {
      const handoffProject = createIncidentHandoffGuideProject();
      const a7Handoff = handoffProject.artifacts.A7;

      expect(a7Handoff.ownership).toContain("Guide owner");
      expect(a7Handoff.version).toBe("1.0.0");
      expect(a7Handoff.pins.contract).toMatch(/^methodological-guide-authoring@/);
      expect(a7Handoff.review_triggers.length).toBeGreaterThanOrEqual(3);
      expect(a7Handoff.feedback_and_deviations).toContain("incident commander");
      expect(a7Handoff.distribution_and_retirement).toBeDefined();
      expect(a7Handoff.retirement_criteria?.length).toBeGreaterThanOrEqual(2);

      const metaProject = createMetamethodologicalGuideProject();
      const a7Meta = metaProject.artifacts.A7;
      expect(a7Meta.ownership).toContain("Contract owner");
      expect(a7Meta.active_successor).toBe("round-2");
      expect(a7Meta.retirement_criteria?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Slice 5: Run Audit Trail (Declared/Prohibited Inputs, Interventions, Routes, Receipts)", () => {
    it("emits complete run report with 0 prohibited inputs and 0 interventions for clean session", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      const report = session.getRunReport();
      expect(report.taskId).toBe("dependency-review-guide-authoring");
      expect(report.declaredInputs.length).toBeGreaterThanOrEqual(4);
      expect(report.prohibitedInputs).toEqual([]);
      expect(report.interventions).toEqual([]);
      expect(report.routeChoices).toContain(".agents/skills/methodize/SKILL.md");
      expect(report.artifacts.length).toBe(8);
      expect(report.receipts.length).toBeGreaterThanOrEqual(2);
      expect(report.receipts.some((r) => r.type === "external_verification")).toBe(true);
      expect(report.receipts.some((r) => r.type === "self_consistency")).toBe(true);
    });

    it("records prohibited inputs and interventions when detected or logged", () => {
      const session = new MethodologyTeachingSession();
      session.detectProhibitedInput("shadow-contract-copy");
      session.recordIntervention("Author clarified A3 authority boundaries");

      const report = session.getRunReport();
      expect(report.prohibitedInputs).toContain("shadow-contract-copy");
      expect(report.interventions).toContain("Author clarified A3 authority boundaries");
    });
  });

  describe("Slice 6: Independent Multi-Claim Evaluation Reporting", () => {
    it("reports faded performance, structural transfer, targeted recovery, and acyclicity as separate claims", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      // In a clean run without injected faults, recovery is INCONCLUSIVE while all other claims are SUPPORTED
      const cleanClaims = session.getClaimsReport();
      expect(cleanClaims.overallPassed).toBe(true);
      expect(cleanClaims.claims.faded_performance.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.structural_transfer.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.acyclicity.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.targeted_recovery.status).toBe("INCONCLUSIVE");

      // Inject and resolve all 5 faults
      session.recordFault("pin_failure", "Unpinned contract");
      session.repairPin();
      session.recordFault("invalid_artifact", "Corrupt A2", "A2");
      session.repairArtifact("A2", createDefaultGuideProject().artifacts.A2);
      session.recordFault("rationale_failure", "Broken link");
      session.repairRationaleLink();
      session.recordFault("authority_failure", "Synthesized authority");
      session.repairAuthority("novice_reviewer", ["gather_inputs", "run_checks", "record_disposition"]);
      session.recordFault("circularity_failure", "Circular proof");
      session.repairCircularity();

      const exercisedClaims = session.getClaimsReport();
      expect(exercisedClaims.overallPassed).toBe(true);
      expect(exercisedClaims.claims.targeted_recovery.status).toBe("SUPPORTED");
      expect(exercisedClaims.claims.targeted_recovery.evidence).toContain("All 5 injected fault(s) resolved");
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

      session.recordFault("invalid_artifact", "Unresolved corrupted schema in custom card");
      const claims = session.getClaimsReport();
      expect(claims.overallPassed).toBe(false);
      expect(claims.claims.targeted_recovery.status).toBe("FALSIFIED");
      expect(claims.claims.targeted_recovery.evidence).toContain("1/1 fault(s) remain unresolved");
    });
  });
});
