import { describe, expect, it } from "vitest";
import { EdgeSchema, type EdgeType } from "../../../src/core/schemas/edges.js";

const valid = (type: EdgeType, source: string, target: string): boolean =>
  EdgeSchema.safeParse({ source, target, type }).success;

describe("directed edge endpoint contracts", () => {
  it.each([
    ["supports", "EVD-1", "HYP-1"],
    ["contradicts", "HYP-1", "ASM-1"],
    ["depends_on", "CAN-1", "ASM-1"],
    ["derived_from", "CLM-1", "OBS-1"],
    ["falsifies", "EVD-1", "ASM-1"],
    ["invalidates", "ASM-1", "CAN-1"],
    ["satisfies", "CAN-1", "CLM-1"],
    ["violates", "EVD-1", "CLM-1"],
    ["references", "DEC-1", "OBS-1"],
    ["answers", "EVD-1", "EVDREQ-1"],
    ["tests", "EVD-1", "CAN-1"],
    ["supersedes", "DEC-1", "DEC-2"],
  ] as const)("accepts the canonical %s pair", (type, source, target) => {
    expect(valid(type, source, target)).toBe(true);
  });

  it.each([
    ["supports", "EVDREQ-1", "HYP-1"],
    ["contradicts", "EVD-1", "EVDREQ-1"],
    ["depends_on", "EVD-1", "ASM-1"],
    ["derived_from", "EVDREQ-1", "EVD-1"],
    ["falsifies", "EVDREQ-1", "ASM-1"],
    ["invalidates", "EVDREQ-1", "CAN-1"],
    ["satisfies", "EVDREQ-1", "EVD-1"],
    ["violates", "EVDREQ-1", "EVD-1"],
    ["references", "TASK-1", "TASK-1"],
    ["answers", "EVDREQ-1", "EVD-1"],
    ["tests", "CLM-1", "CAN-1"],
    ["supersedes", "DEC-1", "CAN-1"],
  ] as const)("rejects the invalid %s pair", (type, source, target) => {
    expect(valid(type, source, target)).toBe(false);
  });
});
