import { describe, expect, it } from "vitest";
import {
  validateMethodContract,
  resolveMethodContract,
  checkProfileCompletion,
} from "../../src/method-contract/index.js";
import { createValidContract } from "./fixtures.js";

describe("Reject Unsafe Method Contract Changes (Ticket 02)", () => {
  describe("Rationale Reference Resolution and Integrity", () => {
    it("rejects unresolvable or empty rationale references in artifacts", () => {
      const invalid = createValidContract();
      invalid.artifacts.A0.rationale_ref = "   ";

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(
        result.problems.some((p) => p.includes("rationale_ref") || p.includes("rationale")),
      ).toBe(true);
    });

    it("rejects unresolvable anchor references that do not exist in the referenced guide document", () => {
      const invalid = createValidContract();
      invalid.artifacts.A0.rationale_ref =
        "docs/designing_methodological_guides.md#non-existent-anchor-xyz";

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(
        result.problems.some((p) => p.includes("non-existent-anchor-xyz") || p.includes("unresolved")),
      ).toBe(true);
    });

    it("accepts valid anchor references that resolve in the guide document", () => {
      const valid = createValidContract();
      const result = validateMethodContract(valid);
      expect(result.valid).toBe(true);
    });
  });

  describe("Predicate and JSON Schema Validation", () => {
    it("rejects invalid JSON Schema types in rule triggers", () => {
      const invalid = createValidContract();
      invalid.rules[0].trigger.schema = {
        type: "non-existent-type",
      } as Record<string, unknown>;

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(
        result.problems.some((p) => p.includes("schema") || p.includes("type")),
      ).toBe(true);
    });

    it("rejects invalid required fields format in schema predicates", () => {
      const invalid = createValidContract();
      invalid.rules[0].trigger.schema = {
        type: "object",
        required: "must-be-an-array-not-a-string",
      } as unknown as Record<string, unknown>;

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(
        result.problems.some((p) => p.includes("schema") || p.includes("required")),
      ).toBe(true);
    });

    it("strictly matches primitive types in predicates", () => {
      const invalid = createValidContract();
      const resolved = resolveMethodContract(invalid, { profile: "pilot" });
      expect(resolved.valid).toBe(true);
      if (!resolved.valid || !resolved.profile) return;

      const completion = checkProfileCompletion(resolved.profile, {
        artifacts: {
          A0: "a-primitive-string-instead-of-object",
        },
        receipts: [],
      });
      expect(completion.complete).toBe(false);
      expect(completion.invalidArtifacts).toContain("A0");
    });
  });

  describe("Exclusion of Arbitrary Scripts, Callbacks, and Overpowered Effects", () => {
    it("rejects action blocks attempting code injection or arbitrary effects", () => {
      const invalid = createValidContract();
      invalid.rules[0].action = [
        {
          kind: "execute_script" as unknown as "stop",
          code: "require('child_process').execSync('rm -rf /')",
        } as unknown as { kind: "stop"; reason: string },
      ];

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.length).toBeGreaterThan(0);
    });

    it("rejects branch then-blocks containing arbitrary callbacks or functions", () => {
      const invalid = createValidContract();
      invalid.rules[0].branches = [
        {
          when: { target: "context", schema: { type: "object" } },
          then: [
            {
              kind: "callback" as unknown as "stop",
              fn: "() => true",
            } as unknown as { kind: "stop"; reason: string },
          ],
        },
      ];

      const result = validateMethodContract(invalid);
      expect(result.valid).toBe(false);
      if (result.valid) return;
      expect(result.problems.length).toBeGreaterThan(0);
    });
  });

  describe("Receipt Class Separation in Profile Completion", () => {
    it("rejects evidence-focused completion when only self-consistency receipts are provided", () => {
      const contract = createValidContract();
      const resolved = resolveMethodContract(contract, {
        profile: "evidence_focused",
      });
      expect(resolved.valid).toBe(true);
      if (!resolved.valid || !resolved.profile) return;

      const completion = checkProfileCompletion(resolved.profile, {
        artifacts: {
          A0: { user_and_situation: {}, action: {}, learning_path: {}, verification: {}, rationale_and_unknowns: {}, next_step: {} },
          A1: { problem: "x", desired_outcome: "y" },
          A2: { claims: [] },
          A3: { roles: [], real_tasks: [] },
          A4: { rules: [] },
          A5: { meaningful_task: {}, worked_example: {} },
          A6: { hypotheses: [], pilot: {}, decisions: [] },
          A7: { ownership: "owner", version: "1.0.0", history: [] },
        },
        receipts: [
          // Providing self-consistency receipts, but NOT external-verification
          "audit-49",
          "leave-one-out",
          "fixed-point",
          "no-circular-validation",
        ],
      });

      expect(completion.complete).toBe(false);
      expect(completion.missingReceipts).toContain("external-verification");
      expect(
        completion.problems.some((p) =>
          p.includes("external-verification") || p.includes("receipt"),
        ),
      ).toBe(true);
    });

    it("rejects metamethodological completion when external receipt is present but self-consistency receipts are missing", () => {
      const contract = createValidContract();
      const resolved = resolveMethodContract(contract, {
        profile: "metamethodological",
      });
      expect(resolved.valid).toBe(true);
      if (!resolved.valid || !resolved.profile) return;

      const completion = checkProfileCompletion(resolved.profile, {
        artifacts: {
          A0: { user_and_situation: {}, action: {}, learning_path: {}, verification: {}, rationale_and_unknowns: {}, next_step: {} },
          A1: { problem: "x", desired_outcome: "y" },
          A2: { claims: [] },
          A3: { roles: [], real_tasks: [] },
          A4: { rules: [] },
          A5: { meaningful_task: {}, worked_example: {} },
          A6: { hypotheses: [], pilot: {}, decisions: [] },
          A7: { ownership: "owner", version: "1.0.0", history: [] },
        },
        receipts: ["external-verification"],
      });

      expect(completion.complete).toBe(false);
      expect(completion.missingReceipts).toContain("audit-49");
      expect(completion.missingReceipts).toContain("fixed-point");
    });

    it("passes completion when both schema-valid artifacts and exact required receipt classes are present", () => {
      const contract = createValidContract();
      const resolved = resolveMethodContract(contract, {
        profile: "metamethodological",
      });
      expect(resolved.valid).toBe(true);
      if (!resolved.valid || !resolved.profile) return;

      const completion = checkProfileCompletion(resolved.profile, {
        artifacts: {
          A0: { user_and_situation: {}, action: {}, learning_path: {}, verification: {}, rationale_and_unknowns: {}, next_step: {} },
          A1: { problem: "x", desired_outcome: "y" },
          A2: { claims: [] },
          A3: { roles: [], real_tasks: [] },
          A4: { rules: [] },
          A5: { meaningful_task: {}, worked_example: {} },
          A6: { hypotheses: [], pilot: {}, decisions: [] },
          A7: { ownership: "owner", version: "1.0.0", history: [] },
        },
        receipts: [
          "external-verification",
          "audit-49",
          "leave-one-out",
          "fixed-point",
          "no-circular-validation",
        ],
      });

      expect(completion.complete).toBe(true);
      expect(completion.missingReceipts).toHaveLength(0);
      expect(completion.missingArtifacts).toHaveLength(0);
      expect(completion.problems).toHaveLength(0);
    });
  });

  describe("Deterministic Fail-Closed Behavior and Stable Diagnostics", () => {
    it("returns deterministic structured diagnostics on failure without mutating input or external state", () => {
      const invalid = createValidContract();
      delete (invalid.artifacts.A0 as unknown as Record<string, unknown>).role;
      invalid.version = "";

      const result1 = validateMethodContract(invalid);
      const result2 = validateMethodContract(invalid);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      if (result1.valid || result2.valid) return;

      expect(result1.problems).toEqual(result2.problems);
      expect(result1.diagnostics).toEqual(result2.diagnostics);
      expect(result1.diagnostics.length).toBeGreaterThanOrEqual(2);
    });
  });
});
