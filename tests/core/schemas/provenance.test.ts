import { describe, expect, it } from "vitest";
import {
  EDGE_TYPES,
  EdgeSchema,
} from "../../../src/core/schemas/edges.js";
import {
  PROVENANCE_ORDER,
  isMoreRigorous,
  meetProvenance,
} from "../../../src/core/types/provenance.js";

describe("provenance lattice", () => {
  it("orders every provenance level strictly", () => {
    for (let index = 0; index < PROVENANCE_ORDER.length - 1; index += 1) {
      const weaker = PROVENANCE_ORDER[index];
      const stronger = PROVENANCE_ORDER[index + 1];
      expect(isMoreRigorous(stronger, weaker)).toBe(true);
      expect(isMoreRigorous(weaker, stronger)).toBe(false);
    }
  });

  it("returns the weakest premise from a set", () => {
    expect(meetProvenance(["FACT", "ASSUMED", "MEASURED"])).toBe("ASSUMED");
    expect(meetProvenance(["FACT", "DERIVED"])).toBe("DERIVED");
    expect(meetProvenance([])).toBe("DECIDED");
  });
});

describe("directed epistemic edges", () => {
  it.each(EDGE_TYPES)("accepts the %s relation", (type) => {
    expect(
      EdgeSchema.safeParse({
        source: type === "falsifies" ? "EVD-001" : "TASK-001",
        type,
        target: type === "falsifies" ? "ASM-001" : "TASK-002",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown relations and malformed node references", () => {
    expect(
      EdgeSchema.safeParse({
        source: "TASK-001",
        type: "unknown_relation",
        target: "TASK-002",
      }).success,
    ).toBe(false);
    expect(
      EdgeSchema.safeParse({
        source: "not-a-node",
        type: "supports",
        target: "TASK-002",
      }).success,
    ).toBe(false);
  });

  it("enforces the evidence falsification relation", () => {
    expect(
      EdgeSchema.safeParse({
        source: "EVD-001",
        type: "falsifies",
        target: "ASM-001",
      }).success,
    ).toBe(true);
    expect(
      EdgeSchema.safeParse({
        source: "TASK-001",
        type: "falsifies",
        target: "ASM-001",
      }).success,
    ).toBe(false);
  });
});
