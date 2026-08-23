import type { MethodContract } from "../../src/method-contract/index.js";

export const createValidContract = (): MethodContract => ({
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
        required: ["problem", "desired_outcome"],
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
        required: ["roles", "real_tasks"],
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
        required: ["meaningful_task", "worked_example"],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a5",
    },
    A6: {
      id: "A6",
      role: "verification-protocol",
      schema: {
        type: "object",
        required: ["hypotheses", "pilot", "decisions"],
      },
      rationale_ref: "docs/designing_methodological_guides.md#a6",
    },
    A7: {
      id: "A7",
      role: "lifecycle-log",
      schema: {
        type: "object",
        required: ["ownership", "version", "history"],
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
  ],
  lifecycle: {
    owner: "method-owner",
    status: "draft",
    version: "1.0.0-draft",
    review_triggers: ["new-evidence", "recurring-error"],
  },
});
