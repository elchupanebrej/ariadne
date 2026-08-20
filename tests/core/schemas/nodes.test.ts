import { describe, expect, it } from "vitest";
import {
  NODE_TYPES,
  NodeSchema,
  NodeSchemas,
  type NodeType,
} from "../../../src/core/schemas/nodes.js";

const node = (type: NodeType) => ({
  id: `${type}-001`,
  type,
  provenance_type: "PROPOSED",
  statement: "A typed epistemic node",
  ...(type === "TRANS"
    ? {
        target_mechanism_ref: "CAN-001",
        retirement_predicate: "legacy path is unused",
        expiration_deadline: "2099-01-01",
        cleanup_verification_test: "npm test -- cleanup",
        owner: "platform",
        lifecycle_state: "PROPOSED",
      }
    : {}),
});

describe("canonical epistemic nodes", () => {
  it.each(NODE_TYPES)("accepts %s nodes", (type) => {
    expect(NodeSchema.safeParse(node(type)).success).toBe(true);
    expect(NodeSchemas[type].safeParse(node(type)).success).toBe(true);
  });

  it("rejects an unknown identifier prefix", () => {
    expect(NodeSchema.safeParse(node("TASK")).success).toBe(true);
    expect(
      NodeSchema.safeParse({ ...node("TASK"), id: "CLAIM-001" }).success,
    ).toBe(false);
  });

  it("rejects an identifier whose prefix disagrees with its type", () => {
    expect(
      NodeSchema.safeParse({ ...node("TASK"), id: "FRAME-001" }).success,
    ).toBe(false);
  });

  it("requires provenance and a non-empty statement", () => {
    expect(
      NodeSchema.safeParse({ id: "TASK-001", type: "TASK" }).success,
    ).toBe(false);
    expect(
      NodeSchema.safeParse({ ...node("TASK"), statement: "" }).success,
    ).toBe(false);
  });

  it("requires the complete transition decommissioning contract", () => {
    expect(
      NodeSchema.safeParse({
        id: "TRANS-001",
        type: "TRANS",
        provenance_type: "PROPOSED",
        statement: "temporary path",
      }).success,
    ).toBe(false);
  });
});
