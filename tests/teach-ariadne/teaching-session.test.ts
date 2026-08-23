import { describe, expect, it } from "vitest";
import {
  AriadneTeachingSession,
  createAriadneTeachingSession,
  parseConfigLine,
  runParserCheck,
} from "../../src/teach-ariadne/index.js";

describe("Teach Ariadne through Parser Decision (Ticket 03)", () => {
  describe("Clean Session & Declared Input Manifest", () => {
    it("initializes a clean session with an auditable input manifest and unstarted state", () => {
      const session = createAriadneTeachingSession();
      const state = session.getState();

      expect(state.phase).toBe("not_started");
      expect(state.status).toBe("learning");
      expect(state.loadedSources).toHaveLength(0);
      expect(state.manifest.taskId).toBe("config-line-parser-decision");
      expect(state.manifest.declaredInputs.length).toBeGreaterThanOrEqual(5);
      expect(state.isolatedGraphPath).toContain("example/.ariadne");
    });
  });

  describe("Progressive Rule Loading", () => {
    it("loads router and rules only when their triggers fire", () => {
      const session = createAriadneTeachingSession();

      session.startTask();
      expect(session.getState().loadedSources).toEqual([".agents/skills/ariadne/SKILL.md"]);

      session.runUncertaintyIngress();
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/05-uncertainty.md");

      session.frameBehavior();
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/10-frame.md");
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/00-core.md");

      session.exploreCandidates();
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/40-explore.md");

      session.filterAndSelect();
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/80-value.md");

      session.runValidation();
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/90-validate.md");
      expect(session.getState().loadedSources).toContain(".agents/skills/ariadne/rules/evidence.md");

      // Verify unneeded rules were NOT loaded
      const loaded = session.getState().loadedSources;
      expect(loaded).not.toContain(".agents/skills/ariadne/rules/20-diagnose.md");
      expect(loaded).not.toContain(".agents/skills/ariadne/rules/30-transform.md");
      expect(loaded).not.toContain(".agents/skills/ariadne/rules/50-knowledge.md");
      expect(loaded).not.toContain(".agents/skills/ariadne/rules/60-dependencies.md");
      expect(loaded).not.toContain(".agents/skills/ariadne/rules/70-dynamics.md");
    });

    it("fails closed if all rules are bulk-preloaded", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.bulkLoadAllRules();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();
      session.runValidation();
      session.submitSelfExplanation({
        q1_mechanism_vs_requirement: "Package is a mechanism to achieve parsing, not the behavioral requirement.",
        q2_hard_filter_rationale: "JSON breaks format compatibility, env boundary violates interface ownership.",
        q3_evidence_rung_scope: "Rung 3 covers algorithmic logic only, not distributed safety or performance.",
        q4_unloaded_rules_rationale: "Diagnose/Dynamics were not relevant to static deterministic parsing logic.",
      });
      session.completeFadedCase();
      session.routeTransferCase();

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => b.includes("bulk") || b.includes("rule"))).toBe(true);
    });

    it("fails closed if Method Contract normative prose is copied into the lesson", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.flagCopiedMethodContractProse();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();
      session.runValidation();
      session.submitSelfExplanation({
        q1_mechanism_vs_requirement: "Package is a mechanism.",
        q2_hard_filter_rationale: "JSON and env boundary violate hard requirements.",
        q3_evidence_rung_scope: "Rung 3 supports algorithmic logic only.",
        q4_unloaded_rules_rationale: "Unnecessary rules omitted.",
      });
      session.completeFadedCase();
      session.routeTransferCase();

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(false);
      expect(completion.blockers.some((b) => b.includes("copied") || b.includes("Method Contract"))).toBe(true);
    });
  });

  describe("Candidate Mechanism Exploration and Hard Filtering", () => {
    it("creates three structurally distinct candidates and hard-filters JSON and environment mechanisms", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();

      const state = session.getState();
      expect(state.artifacts).toContain("FRAME-config-line-parser");
      expect(state.artifacts).toContain("SPACE-config-line-parser");
      expect(state.artifacts).toContain("CAN-first-delimiter-stdlib");
      expect(state.artifacts).toContain("CAN-json-input");
      expect(state.artifacts).toContain("CAN-environment-boundary");

      session.filterAndSelect();
      const afterValue = session.getState();
      expect(afterValue.artifacts).toContain("VAL-SELECT-config-line-parser");
      expect(afterValue.artifacts).toContain("EVDREQ-config-line-parser-r3");
      expect(afterValue.selectedCandidate).toBe("CAN-first-delimiter-stdlib");
      expect(afterValue.rejectedCandidates).toEqual(["CAN-json-input", "CAN-environment-boundary"]);
    });
  });

  describe("Runnable Parser Checks & Evidence Result", () => {
    it("correctly parses valid config lines and throws on invalid lines", () => {
      expect(parseConfigLine("A=1")).toEqual(["A", "1"]);
      expect(parseConfigLine("TOKEN=a=b")).toEqual(["TOKEN", "a=b"]);
      expect(() => parseConfigLine("=x")).toThrow();
      expect(() => parseConfigLine("NO_DELIMITER")).toThrow();
    });

    it("executes runnable checks emitting matched Rung 3 Evidence Result before locking decision", () => {
      const checkResult = runParserCheck();
      expect(checkResult.passed).toBe(true);
      expect(checkResult.casesCount).toBe(4);

      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();
      session.runValidation();

      const state = session.getState();
      expect(state.runnableCheckPassed).toBe(true);
      expect(state.artifacts).toContain("EVD-config-line-parser-r3");
      expect(state.artifacts).toContain("DEC-config-line-parser");
    });
  });

  describe("Self-Explanation, Fading, and Transfer Gates", () => {
    it("prohibits self-explanation before runnable check passes", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();

      expect(() =>
        session.submitSelfExplanation({
          q1_mechanism_vs_requirement: "Package is a mechanism.",
          q2_hard_filter_rationale: "Rejected before scoring.",
          q3_evidence_rung_scope: "Rung 3 algorithmic.",
          q4_unloaded_rules_rationale: "Irrelevant rules.",
        }),
      ).toThrow();
    });

    it("accepts valid self-explanations and completes the full minimal path", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();
      session.runValidation();

      session.submitSelfExplanation({
        q1_mechanism_vs_requirement: "A proposed package is one candidate mechanism to satisfy the parsing contract, not a behavioral requirement.",
        q2_hard_filter_rationale: "JSON input breaks compatibility with the existing format, and environment boundary changes the ownership model; both violate hard requirements.",
        q3_evidence_rung_scope: "Rung 3 assertions prove deterministic algorithmic logic but cannot claim distributed safety, performance, or multi-agent stability.",
        q4_unloaded_rules_rationale: "Diagnose, Transform, Knowledge, Dependencies, and Dynamics were not loaded because their specific triggers did not fire during this static parsing decision.",
      });

      session.completeFadedCase();
      session.routeTransferCase();

      const completion = session.attemptCompletion();
      expect(completion.passed).toBe(true);
      expect(completion.blockers).toHaveLength(0);
      expect(session.getState().status).toBe("independent");
    });
  });

  describe("Graph Isolation", () => {
    it("ensures teaching artifacts exist in isolated graph without mutating live repo graph", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();
      session.runValidation();

      const graph = session.getIsolatedGraph();
      const nodeIds = graph.nodes.map((n) => n.id);

      expect(nodeIds).toContain("FRAME-config-line-parser");
      expect(nodeIds).toContain("SPACE-config-line-parser");
      expect(nodeIds).toContain("CAN-first-delimiter-stdlib");
      expect(nodeIds).toContain("CAN-json-input");
      expect(nodeIds).toContain("CAN-environment-boundary");
      expect(nodeIds).toContain("VAL-SELECT-config-line-parser");
      expect(nodeIds).toContain("EVDREQ-config-line-parser-r3");
      expect(nodeIds).toContain("EVD-config-line-parser-r3");
      expect(nodeIds).toContain("DEC-config-line-parser");
    });
  });
});
