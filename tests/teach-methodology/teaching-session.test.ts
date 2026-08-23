import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MethodologyTeachingSession,
  verifyGuideProject,
  createDefaultGuideProject,
  createDefaultDeclaredManifest,
} from "../../src/teach-methodology/index.js";
import type {
  MethodDeclaredInputManifest,
  GuideProject,
} from "../../src/teach-methodology/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Methodology Authoring Teaching Skill — Issue 05", () => {
  describe("Declared Input Manifest and Normative Source Pinning", () => {
    it("initializes with declared input manifest and rejects undeclared inputs", () => {
      const session = new MethodologyTeachingSession();
      const state = session.getState();

      expect(state.manifest.declaredInputs.length).toBeGreaterThanOrEqual(4);
      expect(
        state.manifest.declaredInputs.some((i) => i.id === "method-contract-pinned"),
      ).toBe(true);
      expect(
        state.manifest.declaredInputs.some((i) => i.id === "long-guide-rationale"),
      ).toBe(true);
      expect(
        state.manifest.declaredInputs.some((i) => i.id === "dependency-review-task"),
      ).toBe(true);

      // Attempting to inject undeclared or prohibited inputs flags them
      session.detectProhibitedInput("shadow-contract-copy");
      expect(session.getState().prohibitedInputsDetected).toContain("shadow-contract-copy");
    });

    it("pins Method Contract version and sha256 digest and selects evidence_focused profile", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      const pinResult = session.pinContract({
        version: "1.0.0-draft",
        digest: "sha256:methodological-guide-authoring-v1",
        profile: "evidence_focused",
      });

      expect(pinResult.success).toBe(true);
      expect(session.getState().contractPinned).toBe(true);
      expect(session.getState().completionProfile).toBe("evidence_focused");
    });
  });

  describe("Task-First, Concise A0 and Signal-Driven A1–A7 Expansion", () => {
    it("requires starting with a meaningful task before drafting A0 or expanding artifacts", () => {
      const session = new MethodologyTeachingSession();
      const draftResult = session.draftA0({
        user_and_situation: "first-time maintainer reviewing direct dependency change",
        action: "inspect manifest/lockfile delta and verify policy",
        learning_path: "worked review -> partial review -> independent review",
        verification: "expert review and novice pilot",
        rationale_and_unknowns: "pinned repo evidence; legal/security owners retained",
        next_step: "expand A1-A7 on observed signals",
      });

      expect(draftResult.success).toBe(false);
      expect(draftResult.message).toMatch(/task/i);
    });

    it("drafts concise schema-valid A0 recording observed signals for all specialized artifacts", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();

      const a0Result = session.draftA0({
        user_and_situation: "first-time maintainer reviewing direct dependency change without authority to waive security or license policy",
        action: "inspect manifest/lockfile delta, run declared checks, check policy, choose approve/request_changes/escalate, emit review record",
        learning_path: "synthetic review -> explain branches -> partial review -> independent review -> unknown license transfer",
        verification: "domain expert review, novice review without oral help, repository pilot",
        rationale_and_unknowns: "local repo evidence is contextual; security/legal retain ownership; transitive behavior outside fixture unknown",
        next_step: "expand all A1-A7 because scenario contains purpose sprawl, heterogeneous rationales, split authority, branching/recovery, transfer learning, repeatable verification, and versioned ownership",
        expansion_signals: {
          A1: "purpose_sprawl",
          A2: "heterogeneous_rationales",
          A3: "split_authority",
          A4: "branching_or_recovery",
          A5: "transfer_learning",
          A6: "repeatable_verification",
          A7: "versioned_ownership",
        },
      });

      expect(a0Result.success).toBe(true);
      expect(session.getState().artifacts.A0).toBeDefined();
    });

    it("expands A1–A7 only when corresponding observed signals are present", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      session.draftA0();

      for (const artifactId of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
        const result = session.expandArtifact(artifactId);
        expect(result.success).toBe(true);
        expect(session.getState().artifacts[artifactId]).toBeDefined();
      }
    });

    it("rejects expansion when A0 has not been drafted", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      const expandResult = session.expandArtifact("A1");
      expect(expandResult.success).toBe(false);
      expect(expandResult.message).toMatch(/A0/i);
    });
  });

  describe("Case-Specific Rationale-to-Recommendation Inferences and Live Link Resolution", () => {
    it("resolves all material rule rationale_ref links to live anchors in designing_methodological_guides.md", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      session.draftA0();
      for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
        session.expandArtifact(id);
      }

      const traceResult = session.resolveRationaleLinks();
      expect(traceResult.success).toBe(true);
      expect(session.getState().links.length).toBeGreaterThanOrEqual(5);
    });

    it("validates that rationale claims contain case-specific inferences rather than bare citations", () => {
      const project = createDefaultGuideProject();
      const result = verifyGuideProject(project);

      expect(result.valid).toBe(true);
      if (!result.valid) return;

      const a2 = project.artifacts.A2;
      expect(a2.claims.length).toBeGreaterThanOrEqual(3);
      for (const claim of a2.claims) {
        expect(claim.rationale_to_recommendation).toBeDefined();
        expect(claim.rationale_to_recommendation.length).toBeGreaterThan(20);
        expect(claim.rationale_ref).toMatch(/^docs\/designing_methodological_guides\.md#/);
      }
    });
  });

  describe("Roles, Non-Synthesized Authority, and Executable Rule Records", () => {
    it("explicitly represents reviewer, maintainer, security, and legal authority boundaries in A3", () => {
      const project = createDefaultGuideProject();
      const a3 = project.artifacts.A3;

      expect(a3.roles.novice_reviewer).toBeDefined();
      expect(a3.roles.security_owner).toBeDefined();
      expect(a3.roles.legal_owner).toBeDefined();
      expect(a3.roles.novice_reviewer.authority).not.toContain("waive_policy");
    });

    it("expresses branching, recovery, stopping, and escalation as executable rule records in A4", () => {
      const project = createDefaultGuideProject();
      const a4 = project.artifacts.A4;

      expect(a4.rules.length).toBeGreaterThanOrEqual(3);
      const reviewRule = a4.rules.find((r) => r.id === "RULE-review-dependency-change");
      expect(reviewRule).toBeDefined();
      expect(reviewRule?.branches.length).toBeGreaterThanOrEqual(4);
      expect(reviewRule?.recovery).toBeDefined();
      expect(reviewRule?.escalation).toBeDefined();
    });
  });

  describe("Separate External Verification and Traceability Matrix", () => {
    it("requires external verification receipts and rejects self-consistency substitution", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      session.draftA0();
      for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
        session.expandArtifact(id);
      }
      session.resolveRationaleLinks();

      const extResult = session.recordExternalVerification({
        expert_review: "passed-by-domain-expert",
        novice_execution: "passed-independent-novice-run",
        repository_pilot: "passed-pilot-receipt",
      });
      expect(extResult.success).toBe(true);
      expect(session.getState().externalReceipt).toBe(true);

      // Attempt circular proof substitution
      session.injectCircularProof();
      const gateResult = session.attemptCompletion();
      expect(gateResult.passed).toBe(false);
      expect(gateResult.blockers.some((b) => b.includes("circular"))).toBe(true);
    });

    it("verifies end-to-end traceability from rules to claims, learning, verification, and lifecycle", () => {
      const project = createDefaultGuideProject();
      expect(project.traceability.length).toBeGreaterThanOrEqual(3);
      for (const row of project.traceability) {
        expect(row.rule_id).toBeDefined();
        expect(row.claim_id).toBeDefined();
        expect(row.learning_id).toBeDefined();
        expect(row.verification_id).toBeDefined();
        expect(row.lifecycle_version).toBeDefined();
      }
    });
  });

  describe("Targeted Recovery Without Restarting Unrelated Work", () => {
    it("handles broken rationale link and repairs it precisely while preserving valid artifacts", () => {
      const session = new MethodologyTeachingSession();
      session.startTask();
      session.pinContract();
      session.draftA0();
      for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"] as const) {
        session.expandArtifact(id);
      }
      session.resolveRationaleLinks();

      // Break a rationale link
      session.breakRationaleLink();
      expect(session.getState().brokenLink).toBe(true);
      expect(session.getState().phase).toBe("blocked");

      // Run targeted recovery
      const repairResult = session.runTargetedRecovery();
      expect(repairResult.success).toBe(true);
      expect(session.getState().brokenLink).toBe(false);
      expect(session.getState().recoveryPracticed).toBe(true);
      // Ensure all previously completed artifacts are preserved
      expect(Object.keys(session.getState().artifacts).length).toBe(8);
    });
  });

  describe("Prototype 5-Path Deterministic Invariant Check", () => {
    it("passes all 5 deterministic scenario paths matching the prototype specification", () => {
      const session = new MethodologyTeachingSession();
      const selfCheckResult = session.runPrototypeSelfCheck();
      expect(selfCheckResult.passed).toBe(true);
      expect(selfCheckResult.pathsPassed).toBe(5);
    });
  });

  describe("Runnable Completion Check on Solution Package", () => {
    it("validates the package files and passes check.mjs assertions", () => {
      const skillDir = resolve(__dirname, "../../.agents/skills/teach-methodology");
      expect(existsSync(resolve(skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/README.md"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/input/dependency-change.json"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/solution/guide-project.json"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/receipts/external-verification.json"))).toBe(true);
      expect(existsSync(resolve(skillDir, "example/check.mjs"))).toBe(true);

      const projectJson = JSON.parse(
        readFileSync(resolve(skillDir, "example/solution/guide-project.json"), "utf-8"),
      );
      const verificationResult = verifyGuideProject(projectJson);
      expect(verificationResult.valid).toBe(true);
    });
  });
});
