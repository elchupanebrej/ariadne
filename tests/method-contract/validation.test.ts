import { describe, expect, it } from "vitest";
import {
  validateMethodContract,
  resolveMethodContract,
  calculateByteDigest,
  type MethodContract,
} from "../../src/method-contract/index.js";

const createValidMethodContract = (): MethodContract => ({
  format: "method-contract/1",
  id: "methodological-guide-authoring",
  version: "1.0.0-draft",
  status: "draft",
  guide: {
    href: "docs/designing_methodological_guides.md",
    role: "rationale-and-provenance",
  },
  artifacts: {
    A0: {
      id: "A0",
      role: "working-map",
      schema: {
        type: "object",
        required: [
          "user_and_situation",
          "action",
          "learning_path",
          "verification",
          "rationale_and_unknowns",
          "next_step",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#working-card",
    },
    A1: {
      id: "A1",
      role: "profile",
      schema: {
        type: "object",
        required: [
          "problem",
          "desired_outcome",
          "target_capability",
          "scope",
          "priority",
          "success_metrics",
          "assumptions_and_constraints",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a1",
    },
    A2: {
      id: "A2",
      role: "rationale-register",
      schema: {
        type: "object",
        required: ["claims"],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a2",
    },
    A3: {
      id: "A3",
      role: "user-map",
      schema: {
        type: "object",
        required: [
          "roles",
          "prior_knowledge",
          "real_tasks",
          "work_context",
          "resources_and_constraints",
          "accessibility_and_equity",
          "user_participation",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a3",
    },
    A4: {
      id: "A4",
      role: "decision-map",
      schema: {
        type: "object",
        required: ["rules"],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a4",
    },
    A5: {
      id: "A5",
      role: "learning-module",
      schema: {
        type: "object",
        required: [
          "meaningful_task",
          "worked_example",
          "decision_model",
          "self_explanation",
          "incomplete_example",
          "independent_task",
          "transfer_case",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a5",
    },
    A6: {
      id: "A6",
      role: "verification-protocol",
      schema: {
        type: "object",
        required: [
          "hypotheses",
          "pilot",
          "expert_review",
          "user_test",
          "transfer_test",
          "implementation",
          "decisions",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a6",
    },
    A7: {
      id: "A7",
      role: "lifecycle-log",
      schema: {
        type: "object",
        required: [
          "ownership",
          "version",
          "review_triggers",
          "feedback",
          "deviations",
          "distribution",
          "history",
        ],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a7",
    },
  },
  rules: [
    {
      id: "expand-a1",
      trigger: {
        target: "context",
        schema: {
          type: "object",
          properties: {
            signals: {
              type: "object",
              properties: { purpose_sprawl: { const: true } },
              required: ["purpose_sprawl"],
            },
          },
          required: ["signals"],
        },
      },
      inputs: ["context"],
      action: [
        {
          kind: "require_artifact",
          artifact: "A1",
        },
      ],
      branches: [],
      output: {
        receipt: "artifact-valid:A1",
      },
      recovery: "complete-or-correct-required-artifact",
      escalation: "stop-if-owner-or-evidence-is-missing",
      rationale_ref: "docs/designing_methodological_guides.md#expansion-guide",
    },
    {
      id: "expand-a4",
      trigger: {
        target: "context",
        schema: {
          type: "object",
          properties: {
            signals: {
              type: "object",
              properties: { branching_or_recovery: { const: true } },
              required: ["branching_or_recovery"],
            },
          },
          required: ["signals"],
        },
      },
      inputs: ["context"],
      action: [
        {
          kind: "require_artifact",
          artifact: "A4",
        },
      ],
      branches: [],
      output: {
        receipt: "artifact-valid:A4",
      },
      recovery: "complete-or-correct-required-artifact",
      escalation: "stop-if-owner-or-evidence-is-missing",
      rationale_ref: "docs/designing_methodological_guides.md#expansion-guide",
    },
  ],
  completion_profiles: {
    pilot: {
      require_artifacts: ["A0"],
      require_receipts: [],
      rationale_ref: "docs/designing_methodological_guides.md#first-cycle",
    },
    working: {
      require_artifacts: ["A0"],
      require_receipts: [],
      rationale_ref: "docs/designing_methodological_guides.md#expansion-guide",
    },
    evidence_focused: {
      require_artifacts: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      require_receipts: ["external-verification"],
      rationale_ref: "docs/designing_methodological_guides.md#epistemology",
    },
    metamethodological: {
      require_artifacts: ["A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7"],
      require_receipts: [
        "external-verification",
        "audit-49",
        "leave-one-out",
        "fixed-point",
        "no-circular-validation",
      ],
      rationale_ref: "docs/designing_methodological_guides.md#fixed-point",
    },
  },
  verification_hooks: [
    {
      id: "validate-artifact",
      on: "artifact.changed",
      check: "artifact-schema",
      owner: "method-maintainer",
      rationale_ref: "docs/designing_methodological_guides.md#basis",
    },
    {
      id: "refresh-obligations",
      on: "context.changed",
      check: "rule-triggers",
      owner: "orchestration-harness",
      rationale_ref: "docs/designing_methodological_guides.md#expansion-guide",
    },
    {
      id: "gate-completion",
      on: "before.complete",
      check: "completion-profile",
      owner: "method-maintainer",
      rationale_ref: "docs/designing_methodological_guides.md#fixed-point",
    },
  ],
  lifecycle: {
    owner: "method-owner",
    status: "draft",
    version: "1.0.0-draft",
    review_triggers: [
      "new-evidence",
      "recurring-error",
      "environment-change",
      "exception-accumulation",
      "metric-degradation",
      "new-audience",
    ],
  },
});

describe("Method Contract Public Validation Boundary", () => {
  describe("Envelope and Deterministic Pinning", () => {
    it("validates a closed method-contract/1 manifest and binds owner version to byte digest", () => {
      const valid = createValidMethodContract();
      const rawJson = JSON.stringify(valid, null, 2);

      const result = validateMethodContract(rawJson);

      expect(result.valid).toBe(true);
      if (!result.valid) return;

      expect(result.contract.id).toBe("methodological-guide-authoring");
      expect(result.contract.version).toBe("1.0.0-draft");
      expect(result.pin.version).toBe("1.0.0-draft");
      expect(result.pin.algorithm).toBe("sha256");
      expect(result.pin.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("produces the same normalized JSON representation on repeated validation", () => {
      const valid = createValidMethodContract();
      const raw1 = JSON.stringify(valid);
      const raw2 = JSON.stringify(valid, null, 4);

      const result1 = validateMethodContract(raw1);
      const result2 = validateMethodContract(raw2);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
      if (!result1.valid || !result2.valid) return;

      expect(result1.normalized).toBe(result2.normalized);
    });

    it("rejects non-UTF-8 or malformed JSON payloads", () => {
      const result = validateMethodContract("{ not valid json ");
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("JSON") || p.includes("parse"))).toBe(true);
    });

    it("rejects unknown top-level envelope fields (closed envelope)", () => {
      const invalid = {
        ...createValidMethodContract(),
        unexpected_extra_field: "not-allowed",
      };

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(
        result.problems.some((p) =>
          p.includes("unexpected_extra_field") || p.includes("unrecognized") || p.includes("unknown"),
        ),
      ).toBe(true);
    });

    it("rejects unsupported format identifier", () => {
      const invalid = {
        ...createValidMethodContract(),
        format: "method-contract/2",
      };

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("format") || p.includes("method-contract/1"))).toBe(true);
    });
  });

  describe("Artifact Records (A0–A7)", () => {
    it("accepts valid A0–A7 artifact records with stable identifier, role, schema predicate, and rationale reference", () => {
      const contract = createValidMethodContract();
      const result = validateMethodContract(contract);

      expect(result.valid).toBe(true);
      if (!result.valid) return;

      expect(Object.keys(result.contract.artifacts)).toEqual([
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "A6",
        "A7",
      ]);
      expect(result.contract.artifacts.A0.id).toBe("A0");
      expect(result.contract.artifacts.A0.role).toBe("working-map");
      expect(result.contract.artifacts.A0.rationale_ref).toBe(
        "docs/designing_methodological_guides.md#working-card",
      );
    });

    it("rejects an artifact record missing mandatory identifier", () => {
      const invalid = createValidMethodContract();
      delete (invalid.artifacts.A0 as unknown as Record<string, unknown>).id;

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("artifacts.A0.id"))).toBe(true);
    });

    it("rejects an artifact record missing operational role", () => {
      const invalid = createValidMethodContract();
      delete (invalid.artifacts.A0 as unknown as Record<string, unknown>).role;

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("artifacts.A0.role"))).toBe(true);
    });

    it("rejects an artifact record missing rationale reference", () => {
      const invalid = createValidMethodContract();
      delete (invalid.artifacts.A0 as unknown as Record<string, unknown>).rationale_ref;

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("artifacts.A0.rationale_ref"))).toBe(true);
    });

    it("rejects an artifact record with empty or invalid schema", () => {
      const invalid = createValidMethodContract();
      (invalid.artifacts.A0 as unknown as Record<string, unknown>).schema = "not-an-object";

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("artifacts.A0.schema"))).toBe(true);
    });
  });

  describe("Rule Records and Supported Effects", () => {
    it("accepts rules with trigger, inputs, ordered actions, branches, output, recovery, escalation, and rationale", () => {
      const contract = createValidMethodContract();
      const result = validateMethodContract(contract);

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.contract.rules).toHaveLength(2);
      expect(result.contract.rules[0].id).toBe("expand-a1");
      expect(result.contract.rules[0].trigger.target).toBe("context");
    });

    it("accepts all supported v1 effect kinds (require_artifact, require_receipt, emit_receipt, select_rule, stop)", () => {
      const contract = createValidMethodContract();
      contract.rules.push({
        id: "rule-with-all-effects",
        trigger: {
          target: "context",
          schema: { type: "object" },
        },
        inputs: ["context"],
        action: [
          { kind: "require_artifact", artifact: "A2" },
          { kind: "require_receipt", receipt: "user-test" },
          { kind: "emit_receipt", receipt: "rule-evaluated" },
          { kind: "select_rule", rule: "expand-a4" },
          { kind: "stop", reason: "missing authority" },
        ],
        branches: [
          {
            when: { target: "context", schema: { type: "object", properties: { error: { const: true } } } },
            then: [{ kind: "stop", reason: "error condition triggered" }],
          },
        ],
        output: { result: "evaluated" },
        recovery: "retry with clean state",
        escalation: "escalate to human owner",
        rationale_ref: "docs/designing_methodological_guides.md#a4",
      });

      const result = validateMethodContract(contract);
      expect(result.valid).toBe(true);
    });

    it("rejects arbitrary scripts, callbacks, free-form strings, or unsupported effect kinds in rules", () => {
      const invalid = createValidMethodContract();
      invalid.rules.push({
        id: "arbitrary-script-rule",
        trigger: { target: "context", schema: { type: "object" } },
        action: [
          {
            kind: "run_script" as unknown as "stop",
            script: "eval('process.exit(1)')",
          } as unknown as { kind: "stop"; reason: string },
        ],
        rationale_ref: "docs/designing_methodological_guides.md#rules",
      });

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("rules.2.action"))).toBe(true);
    });
  });

  describe("Completion Profiles and Obligations Resolution", () => {
    it("resolves pilot profile to A0-only obligation without requiring external receipts", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, { profile: "pilot" });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.profile).toBeDefined();
      expect(result.profile?.name).toBe("pilot");
      expect(result.profile?.obligations.artifacts).toEqual(["A0"]);
      expect(result.profile?.obligations.receipts).toEqual([]);
      expect(result.profile?.obligations.external_verification_receipts).toEqual([]);
      expect(result.profile?.obligations.self_consistency_receipts).toEqual([]);
    });

    it("resolves working profile and expands obligations based on active context signals", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, {
        profile: "working",
        context: {
          signals: {
            branching_or_recovery: true,
          },
        },
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.profile?.name).toBe("working");
      // A0 from profile + A4 from expand-a4 rule trigger
      expect(result.profile?.obligations.artifacts).toContain("A0");
      expect(result.profile?.obligations.artifacts).toContain("A4");
    });

    it("resolves evidence_focused profile with external verification receipt", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, {
        profile: "evidence_focused",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;
      expect(result.profile?.obligations.artifacts).toEqual([
        "A0",
        "A1",
        "A2",
        "A3",
        "A4",
        "A5",
        "A6",
        "A7",
      ]);
      expect(result.profile?.obligations.external_verification_receipts).toEqual([
        "external-verification",
      ]);
      expect(result.profile?.obligations.self_consistency_receipts).toEqual([]);
    });

    it("resolves metamethodological profile keeping external-verification and self-consistency receipts distinct", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, {
        profile: "metamethodological",
      });

      expect(result.valid).toBe(true);
      if (!result.valid) return;

      expect(result.profile?.obligations.external_verification_receipts).toEqual([
        "external-verification",
      ]);
      expect(result.profile?.obligations.self_consistency_receipts).toEqual([
        "audit-49",
        "leave-one-out",
        "fixed-point",
        "no-circular-validation",
      ]);
      // Verify they do not overlap and neither satisfies the other
      for (const sc of result.profile?.obligations.self_consistency_receipts || []) {
        expect(result.profile?.obligations.external_verification_receipts).not.toContain(sc);
      }
    });

    it("rejects resolution of an unknown profile name", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, {
        profile: "non-existent-profile",
      });

      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.some((p) => p.includes("non-existent-profile"))).toBe(true);
    });
  });

  describe("Verification Hooks and Expected Pin Validation", () => {
    it("returns verified hooks matching the contract configuration", () => {
      const contract = createValidMethodContract();
      const result = resolveMethodContract(contract, { profile: "pilot" });

      expect(result.valid).toBe(true);
      if (!result.valid) return;

      expect(result.profile?.verification_hooks).toHaveLength(3);
      expect(result.profile?.verification_hooks[0].id).toBe("validate-artifact");
      expect(result.profile?.verification_hooks[0].on).toBe("artifact.changed");
      expect(result.profile?.verification_hooks[0].check).toBe("artifact-schema");
    });

    it("succeeds when expectedPin matches version and byte digest", () => {
      const contract = createValidMethodContract();
      const rawJson = JSON.stringify(contract, null, 2);
      const expectedDigest = calculateByteDigest(rawJson);

      const result = validateMethodContract(rawJson, {
        expectedPin: {
          version: "1.0.0-draft",
          digest: expectedDigest,
        },
      });

      expect(result.valid).toBe(true);
    });

    it("fails closed when expectedPin version or digest mismatches", () => {
      const contract = createValidMethodContract();
      const rawJson = JSON.stringify(contract, null, 2);

      const versionMismatch = validateMethodContract(rawJson, {
        expectedPin: {
          version: "2.0.0",
        },
      });
      expect(versionMismatch.valid).toBe(false);
      if (versionMismatch.valid) return;
      expect(versionMismatch.problems.some((p) => p.includes("version mismatch"))).toBe(true);

      const digestMismatch = validateMethodContract(rawJson, {
        expectedPin: {
          digest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        },
      });
      expect(digestMismatch.valid).toBe(false);
      if (digestMismatch.valid) return;
      expect(digestMismatch.problems.some((p) => p.includes("digest mismatch"))).toBe(true);
    });
  });
});
