import { describe, expect, it } from "vitest";
import {
  validateMethodContract,
  resolveMethodContract,
  checkProfileCompletion,
} from "../../src/method-contract/index.js";
import { createValidContract } from "./fixtures.js";

interface Mutant {
  id: string;
  category:
    | "isolation"
    | "ownership"
    | "evidence"
    | "lifecycle"
    | "circularity"
    | "deletion";
  description: string;
  mutate: () => unknown;
  test: (mutated: unknown) => boolean; // returns true if mutant was killed (detected/rejected)
}

describe("Mutation Testing Suite for Method Contract Validator (MSI >= 85%)", () => {
  const topLevelDeletionKeys: Array<keyof ReturnType<typeof createValidContract>> = [
    "format",
    "id",
    "version",
    "status",
    "guide",
    "artifacts",
    "rules",
    "completion_profiles",
    "verification_hooks",
    "lifecycle",
  ];

  const deletionMutants: Mutant[] = topLevelDeletionKeys.map((key, idx) => ({
    id: `MUT-DEL-${String(idx + 1).padStart(2, "0")}`,
    category: "deletion",
    description: `Delete top-level property "${key}"`,
    mutate: () => {
      const c = createValidContract();
      delete (c as unknown as Record<string, unknown>)[key];
      return c;
    },
    test: (m) => !validateMethodContract(m).valid,
  }));

  const fineGrainedDeletionMutants: Mutant[] = [
    {
      id: "MUT-DEL-11",
      category: "deletion",
      description: "Delete artifact role in A0",
      mutate: () => {
        const c = createValidContract();
        delete (c.artifacts.A0 as unknown as Record<string, unknown>).role;
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-DEL-12",
      category: "deletion",
      description: "Delete artifact schema in A0",
      mutate: () => {
        const c = createValidContract();
        delete (c.artifacts.A0 as unknown as Record<string, unknown>).schema;
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-DEL-13",
      category: "deletion",
      description: "Delete rule trigger in rule 0",
      mutate: () => {
        const c = createValidContract();
        delete (c.rules[0] as unknown as Record<string, unknown>).trigger;
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
  ];

  const mutants: Mutant[] = [
    // --- 1. ISOLATION MUTANTS ---
    {
      id: "MUT-ISO-01",
      category: "isolation",
      description: "Inject arbitrary extra top-level field into envelope",
      mutate: () => ({
        ...createValidContract(),
        leak_environment: "process.env",
      }),
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-ISO-02",
      category: "isolation",
      description: "Inject executable script command in rule action",
      mutate: () => {
        const c = createValidContract();
        c.rules[0].action = [
          { kind: "exec_cmd" as unknown as "stop", command: "whoami" } as unknown as { kind: "stop"; reason: string },
        ];
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-ISO-03",
      category: "isolation",
      description: "Inject callback function in rule branch then block",
      mutate: () => {
        const c = createValidContract();
        c.rules[0].branches = [
          {
            when: { target: "context", schema: { type: "object" } },
            then: [{ kind: "callback" as unknown as "stop", fn: "() => {}" } as unknown as { kind: "stop"; reason: string }],
          },
        ];
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-ISO-04",
      category: "isolation",
      description: "Inject arbitrary free-form string in rule action",
      mutate: () => {
        const c = createValidContract();
        c.rules[0].action = ["arbitrary prose text" as unknown as { kind: "stop"; reason: string }];
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },

    // --- 2. OWNERSHIP MUTANTS ---
    {
      id: "MUT-OWN-01",
      category: "ownership",
      description: "Omit owner in lifecycle declaration",
      mutate: () => {
        const c = createValidContract();
        delete (c.lifecycle as unknown as Record<string, unknown>).owner;
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-OWN-02",
      category: "ownership",
      description: "Empty owner in verification hook",
      mutate: () => {
        const c = createValidContract();
        c.verification_hooks[0].owner = "";
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-OWN-03",
      category: "ownership",
      description: "Invalid hook event name not in canonical list",
      mutate: () => {
        const c = createValidContract();
        c.verification_hooks[0].on = "invalid.event" as unknown as "before.complete";
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },

    // --- 3. EVIDENCE MUTANTS ---
    {
      id: "MUT-EVD-01",
      category: "evidence",
      description: "Substitute self-consistency receipt for external-verification requirement",
      mutate: () => {
        const c = createValidContract();
        const res = resolveMethodContract(c, { profile: "evidence_focused" });
        if (!res.valid || !res.profile) throw new Error("Setup failed");
        return {
          profile: res.profile,
          state: {
            artifacts: {
              A0: { user_and_situation: {}, action: {}, learning_path: {}, verification: {}, rationale_and_unknowns: {}, next_step: {} },
              A1: { problem: "x", desired_outcome: "y" },
              A2: { claims: [] },
              A3: { roles: [], real_tasks: [] },
              A4: { rules: [] },
              A5: { meaningful_task: {}, worked_example: {} },
              A6: { hypotheses: [], pilot: {}, decisions: [] },
              A7: { ownership: "o", version: "1.0", history: [] },
            },
            receipts: ["audit-49", "fixed-point", "leave-one-out"], // only self-consistency!
          },
        };
      },
      test: (m) => {
        const typed = m as { profile: ReturnType<typeof resolveMethodContract> extends { profile?: infer P } ? P : never; state: { artifacts: Record<string, unknown>; receipts: string[] } };
        const comp = checkProfileCompletion(typed.profile!, typed.state);
        return !comp.complete && comp.missingReceipts.includes("external-verification");
      },
    },
    {
      id: "MUT-EVD-02",
      category: "evidence",
      description: "Omit audit-49 self-consistency receipt in metamethodological profile",
      mutate: () => {
        const c = createValidContract();
        const res = resolveMethodContract(c, { profile: "metamethodological" });
        if (!res.valid || !res.profile) throw new Error("Setup failed");
        return {
          profile: res.profile,
          state: {
            artifacts: {
              A0: { user_and_situation: {}, action: {}, learning_path: {}, verification: {}, rationale_and_unknowns: {}, next_step: {} },
              A1: { problem: "x", desired_outcome: "y" },
              A2: { claims: [] },
              A3: { roles: [], real_tasks: [] },
              A4: { rules: [] },
              A5: { meaningful_task: {}, worked_example: {} },
              A6: { hypotheses: [], pilot: {}, decisions: [] },
              A7: { ownership: "o", version: "1.0", history: [] },
            },
            receipts: ["external-verification", "leave-one-out", "fixed-point", "no-circular-validation"],
          },
        };
      },
      test: (m) => {
        const typed = m as { profile: ReturnType<typeof resolveMethodContract> extends { profile?: infer P } ? P : never; state: { artifacts: Record<string, unknown>; receipts: string[] } };
        const comp = checkProfileCompletion(typed.profile!, typed.state);
        return !comp.complete && comp.missingReceipts.includes("audit-49");
      },
    },
    {
      id: "MUT-EVD-03",
      category: "evidence",
      description: "Invalid artifact schema payload in profile completion",
      mutate: () => {
        const c = createValidContract();
        const res = resolveMethodContract(c, { profile: "pilot" });
        if (!res.valid || !res.profile) throw new Error("Setup failed");
        return {
          profile: res.profile,
          state: {
            artifacts: {
              A0: { not_valid: 123 }, // missing required fields!
            },
            receipts: [],
          },
        };
      },
      test: (m) => {
        const typed = m as { profile: ReturnType<typeof resolveMethodContract> extends { profile?: infer P } ? P : never; state: { artifacts: Record<string, unknown>; receipts: string[] } };
        const comp = checkProfileCompletion(typed.profile!, typed.state);
        return !comp.complete && comp.invalidArtifacts.includes("A0");
      },
    },

    // --- 4. LIFECYCLE MUTANTS ---
    {
      id: "MUT-LIF-01",
      category: "lifecycle",
      description: "Use invalid lifecycle status",
      mutate: () => {
        const c = createValidContract();
        c.status = "invalid_status" as unknown as "draft";
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-LIF-02",
      category: "lifecycle",
      description: "Version mismatch against expected pin",
      mutate: () => {
        const c = createValidContract();
        return JSON.stringify(c);
      },
      test: (m) =>
        !validateMethodContract(m, {
          expectedPin: { version: "9.9.9" },
        }).valid,
    },
    {
      id: "MUT-LIF-03",
      category: "lifecycle",
      description: "Byte digest mismatch against expected pin",
      mutate: () => {
        const c = createValidContract();
        return JSON.stringify(c);
      },
      test: (m) =>
        !validateMethodContract(m, {
          expectedPin: { digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111" },
        }).valid,
    },

    // --- 5. CIRCULARITY & INTEGRITY MUTANTS ---
    {
      id: "MUT-CIR-01",
      category: "circularity",
      description: "Invalid JSON Schema type in trigger predicate",
      mutate: () => {
        const c = createValidContract();
        c.rules[0].trigger.schema = { type: "corrupt-type" };
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-CIR-02",
      category: "circularity",
      description: "Empty rationale reference in artifact record",
      mutate: () => {
        const c = createValidContract();
        c.artifacts.A0.rationale_ref = "   ";
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },
    {
      id: "MUT-CIR-03",
      category: "circularity",
      description: "Unresolvable anchor in rationale reference",
      mutate: () => {
        const c = createValidContract();
        c.artifacts.A0.rationale_ref = "docs/designing_methodological_guides.md#non-existent-anchor-12345";
        return c;
      },
      test: (m) => !validateMethodContract(m).valid,
    },

    // --- 6. DELETION MUTANTS ---
    ...deletionMutants,
    ...fineGrainedDeletionMutants,
  ];

  it("kills 100% of critical mutants across isolation, ownership, evidence, lifecycle, circularity, and deletion categories", () => {
    let killedCount = 0;
    const survivors: string[] = [];

    for (const mutant of mutants) {
      const mutated = mutant.mutate();
      const killed = mutant.test(mutated);
      if (killed) {
        killedCount++;
      } else {
        survivors.push(`[${mutant.id} - ${mutant.category}] ${mutant.description}`);
      }
    }

    const msi = (killedCount / mutants.length) * 100;

    expect(survivors).toHaveLength(0);
    expect(msi).toBeGreaterThanOrEqual(85);
    expect(msi).toBe(100);
  }, 20000);

  it.each(mutants)("kills mutant $id ($category: $description)", (mutant) => {
    const mutated = mutant.mutate();
    const isKilled = mutant.test(mutated);
    expect(isKilled).toBe(true);
  });
});
