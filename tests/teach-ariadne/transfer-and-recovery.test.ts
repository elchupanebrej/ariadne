import { describe, expect, it } from "vitest";
import {
  AriadneTeachingSession,
  createAriadneTeachingSession,
  parseQueryString,
  runQueryStringCheck,
} from "../../src/teach-ariadne/index.js";

describe("Verify Ariadne Transfer, Fading, and Recovery (Ticket 04)", () => {
  function createAndPassWorkedExample(): AriadneTeachingSession {
    const session = createAriadneTeachingSession();
    session.startTask();
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
    return session;
  }

  describe("Slice 1: Faded Query-String Case & Algorithmic Evidence", () => {
    it("parses query strings with standard key-value, repeated keys, and percent decoding", () => {
      const basic = parseQueryString("foo=bar&baz=qux");
      expect(basic).toEqual({ foo: "bar", baz: "qux" });

      const repeated = parseQueryString("tag=alpha&tag=beta&tag=gamma");
      expect(repeated).toEqual({ tag: ["alpha", "beta", "gamma"] });

      const decoded = parseQueryString("greeting=hello%20world&delim=%3D%26");
      expect(decoded).toEqual({ greeting: "hello world", delim: "=&" });

      expect(parseQueryString("?page=1&size=20")).toEqual({ page: "1", size: "20" });
      expect(parseQueryString("")).toEqual({});
    });

    it("rejects empty keys or malformed percent encodings in query strings", () => {
      expect(() => parseQueryString("=value")).toThrow(/empty key/i);
      expect(() => parseQueryString("foo=bar&=bad")).toThrow(/empty key/i);
      expect(() => parseQueryString("key=%ZZ")).toThrow(/malformed percent/i);
    });

    it("executes deterministic query string check emitting Rung 3 evidence receipt", () => {
      const check = runQueryStringCheck();
      expect(check.passed).toBe(true);
      expect(check.casesCount).toBeGreaterThanOrEqual(5);
      expect(check.receipt).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("reproduces candidate selection, hard filtering, and Rung 3 evidence in faded case", () => {
      const session = createAndPassWorkedExample();

      // Complete faded case with candidate selection and evidence shape
      session.completeFadedCase({
        mechanism: "CAN-urlsearchparams-stdlib",
        claimLevel: "R3",
        rejectedCandidates: ["CAN-qs-package", "CAN-regex-split"],
      });

      const state = session.getState();
      expect(state.fadedCaseCompleted).toBe(true);
      expect(state.artifacts).toContain("FRAME-querystring-parser");
      expect(state.artifacts).toContain("VAL-SELECT-querystring-parser");
      expect(state.artifacts).toContain("EVD-querystring-parser-r3");
      expect(state.artifacts).toContain("DEC-querystring-parser");

      const graph = session.getIsolatedGraph();
      const nodeIds = graph.nodes.map((n) => n.id);
      expect(nodeIds).toContain("DEC-querystring-parser");
      expect(nodeIds).toContain("CAN-urlsearchparams-stdlib");
    });
  });

  describe("Slice 2: Duplicate-Effect Retry Transfer Case", () => {
    it("routes transfer case through Diagnose and Dynamics rather than repeating parser Explore route", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      session.routeTransferCase([
        ".agents/skills/ariadne/rules/05-uncertainty.md",
        ".agents/skills/ariadne/rules/20-diagnose.md",
        ".agents/skills/ariadne/rules/70-dynamics.md",
        ".agents/skills/ariadne/rules/80-value.md",
        ".agents/skills/ariadne/rules/90-validate.md",
      ]);

      const state = session.getState();
      expect(state.transferRouteCompleted).toBe(true);
      expect(state.loadedSources).toContain(".agents/skills/ariadne/rules/20-diagnose.md");
      expect(state.loadedSources).toContain(".agents/skills/ariadne/rules/70-dynamics.md");

      expect(state.artifacts).toContain("FRAME-duplicate-effect-retry");
      expect(state.artifacts).toContain("DIAG-duplicate-invoices-timeout");
      expect(state.artifacts).toContain("DYN-client-server-retry-race");
      expect(state.artifacts).toContain("CAN-idempotency-key-dedup");
      expect(state.artifacts).toContain("EVD-idempotency-key-r3");
      expect(state.artifacts).toContain("DEC-idempotency-key-dedup");
    });

    it("rejects copying the parser route for timeout and duplicate invoice transfer case", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();

      // Blindly copying parser route (explore without diagnose/dynamics) must be rejected
      expect(() =>
        session.routeTransferCase([
          "uncertainty",
          "frame",
          "explore",
          "value",
          "validate",
        ]),
      ).toThrow(/expected route starting with Uncertainty -> Diagnose -> Dynamics/i);
    });
  });

  describe("Slice 3: Targeted Recovery Without Restarting Unrelated Work", () => {
    it("repairs an invalid artifact in place while preserving prior valid nodes", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();

      const initialArtifacts = [...session.getState().artifacts];
      expect(initialArtifacts).toContain("FRAME-config-line-parser");
      expect(initialArtifacts).toContain("CAN-first-delimiter-stdlib");

      // Inject fault: invalid node format in CAN-first-delimiter-stdlib
      session.recordFault(
        "invalid_artifact",
        "CAN-first-delimiter-stdlib missing required statement and title",
        "CAN-first-delimiter-stdlib",
      );

      // Perform targeted repair
      const result = session.repairArtifact("CAN-first-delimiter-stdlib", {
        statement: "Use native String.indexOf and String.slice without dependencies.",
        title: "Standard library first delimiter parsing (repaired)",
      });

      expect(result.recovered).toBe(true);
      expect(result.preservedArtifacts).toEqual(initialArtifacts);

      // Verify node was updated in isolated graph without losing other nodes
      const graph = session.getIsolatedGraph();
      const canNode = graph.nodes.find((n) => n.id === "CAN-first-delimiter-stdlib");
      expect(canNode?.title).toContain("repaired");
      expect(graph.nodes.some((n) => n.id === "FRAME-config-line-parser")).toBe(true);
    });

    it("repairs an evidence mismatch in place without restarting exploration or framing", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();
      session.exploreCandidates();
      session.filterAndSelect();

      const artifactsBefore = [...session.getState().artifacts];

      // Inject evidence mismatch fault
      session.recordFault(
        "evidence_mismatch",
        "EVD-config-line-parser-r3 provided Rung 2 compiler check instead of required Rung 3 assertion",
        "EVD-config-line-parser-r3",
      );

      // Targeted repair of evidence
      const recovery = session.recoverEvidence("EVD-config-line-parser-r3", {
        type: "EVD",
        provenance_type: "MEASURED",
        statement: "Deterministic 4-case unit assertion suite verified at Rung 3.",
        title: "Repaired Rung 3 Evidence Receipt",
        status: "ACCEPTED",
        verdict: "SUPPORTED",
        method: "assertion_test",
        rung: 3,
        environment: "node-runtime",
        receipt: "sha256:4073099cd9d9d96dcb4f5e5bf937007e197be88fc26cc2b443d28fb5e526be27",
      });

      expect(recovery.recovered).toBe(true);
      expect(recovery.preservedArtifacts).toContain("FRAME-config-line-parser");
      expect(recovery.preservedArtifacts).toContain("VAL-SELECT-config-line-parser");

      const graph = session.getIsolatedGraph();
      const evdNode = graph.nodes.find((n) => n.id === "EVD-config-line-parser-r3");
      expect((evdNode as unknown as { rung: number })?.rung).toBe(3);
    });

    it("repairs owner boundary redirection without losing work or polluting live overlay", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.runUncertaintyIngress();
      session.frameBehavior();

      // Record owner boundary fault
      session.recordFault(
        "owner_boundary",
        "Attempted unisolated write outside teaching directory",
      );

      const boundaryResult = session.repairOwnerBoundary(".agents/skills/methodize-ariadne/example/.ariadne");
      expect(boundaryResult.recovered).toBe(true);
      expect(boundaryResult.isolatedPath).toBe(".agents/skills/methodize-ariadne/example/.ariadne");
      expect(session.getState().isolatedGraphPath).toBe(".agents/skills/methodize-ariadne/example/.ariadne");
    });
  });

  describe("Slice 4: Run Audit Trail (Declared/Prohibited Inputs, Interventions, Routes, Artifacts, Receipts)", () => {
    it("records full audit trail with declared inputs, routes, artifacts, and receipts", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      const runReport = session.getRunReport();
      expect(runReport.taskId).toBe("config-line-parser-decision");
      expect(runReport.declaredInputs.length).toBeGreaterThanOrEqual(5);
      expect(runReport.prohibitedInputs).toEqual([]);
      expect(runReport.interventions).toEqual([]);
      expect(runReport.routeChoices).toContain(".agents/skills/ariadne/SKILL.md");
      expect(runReport.routeChoices).toContain(".agents/skills/ariadne/rules/05-uncertainty.md");
      expect(runReport.routeChoices).toContain(".agents/skills/ariadne/rules/20-diagnose.md");
      expect(runReport.routeChoices).toContain(".agents/skills/ariadne/rules/70-dynamics.md");
      expect(runReport.artifacts).toContain("FRAME-config-line-parser");
      expect(runReport.artifacts).toContain("FRAME-querystring-parser");
      expect(runReport.artifacts).toContain("FRAME-duplicate-effect-retry");
      expect(runReport.receipts.length).toBeGreaterThanOrEqual(3);
      expect(runReport.receipts.every((r) => r.rung === 3 && r.digest.startsWith("sha256:"))).toBe(true);
    });

    it("records prohibited input detection when rules are bulk-loaded", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.bulkLoadAllRules();

      const runReport = session.getRunReport();
      expect(runReport.prohibitedInputs).toContain("bulk-preloaded-ariadne-rules");
    });

    it("records interventions when author assistance is logged", () => {
      const session = createAriadneTeachingSession();
      session.startTask();
      session.recordIntervention("Clarified that proposed package is a mechanism");

      const runReport = session.getRunReport();
      expect(runReport.interventions).toContain("Clarified that proposed package is a mechanism");
    });
  });

  describe("Slice 5: Independent 4-Claim Evaluation Reporting", () => {
    it("reports recall, faded performance, structural transfer, and recovery as separate claims", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      // Clean run without fault injection: recovery is INCONCLUSIVE while overall passes
      const cleanClaims = session.getClaimsReport();
      expect(cleanClaims.overallPassed).toBe(true);
      expect(cleanClaims.claims.recall.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.faded_performance.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.structural_transfer.status).toBe("SUPPORTED");
      expect(cleanClaims.claims.targeted_recovery.status).toBe("INCONCLUSIVE");

      // Inject and resolve a targeted recovery fault
      session.recordFault("owner_boundary", "Attempted live write");
      session.repairOwnerBoundary();

      const exercisedClaims = session.getClaimsReport();
      expect(exercisedClaims.overallPassed).toBe(true);
      expect(exercisedClaims.claims.targeted_recovery.status).toBe("SUPPORTED");
      expect(exercisedClaims.claims.targeted_recovery.evidence).toContain("Resolved faults: 1/1");
    });

    it("maintains claim independence: missing faded case does not falsify recall or compensate transfer", () => {
      const session = createAndPassWorkedExample();
      // Notice: faded case and transfer are NOT completed yet

      const claimsReport = session.getClaimsReport();
      expect(claimsReport.overallPassed).toBe(false);
      expect(claimsReport.claims.recall.status).toBe("SUPPORTED");
      expect(claimsReport.claims.faded_performance.status).toBe("FALSIFIED");
      expect(claimsReport.claims.structural_transfer.status).toBe("FALSIFIED");
    });

    it("fails targeted recovery claim when unresolved faults remain", () => {
      const session = createAndPassWorkedExample();
      session.completeFadedCase();
      session.routeTransferCase();

      // Unresolved fault
      session.recordFault("invalid_artifact", "Unresolved corrupted schema in custom node");

      const claimsReport = session.getClaimsReport();
      expect(claimsReport.overallPassed).toBe(false);
      expect(claimsReport.claims.recall.status).toBe("SUPPORTED");
      expect(claimsReport.claims.faded_performance.status).toBe("SUPPORTED");
      expect(claimsReport.claims.structural_transfer.status).toBe("SUPPORTED");
      expect(claimsReport.claims.targeted_recovery.status).toBe("FALSIFIED");

      // After targeted repair, recovery passes
      session.repairArtifact("CUSTOM-node", {
        id: "CUSTOM-node",
        type: "FACT",
        provenance_type: "FACT",
        statement: "Valid repaired statement",
        title: "Repaired node",
        status: "ACCEPTED",
      } as unknown as Partial<import("../../src/core/schemas/nodes.js").Node>);

      const fixedReport = session.getClaimsReport();
      expect(fixedReport.overallPassed).toBe(true);
      expect(fixedReport.claims.targeted_recovery.status).toBe("SUPPORTED");
    });
  });
});
