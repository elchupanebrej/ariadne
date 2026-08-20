import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rulesRoot = fileURLToPath(
  new URL("../../.agents/skills/ariadne/rules/", import.meta.url),
);

const readRule = (name: string) =>
  readFileSync(`${rulesRoot}/${name}`, "utf8");

describe("Ariadne solution-space rules", () => {
  it("publishes transform, explore, and knowledge rule entrypoints", () => {
    for (const name of ["30-transform.md", "40-explore.md", "50-knowledge.md"]) {
      expect(existsSync(`${rulesRoot}/${name}`)).toBe(true);
    }
  });

  it("keeps the complete 36-technique index and trimming contract", () => {
    const transform = readRule("30-transform.md");

    for (const operation of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      for (let technique = 1; technique <= (operation === 3 ? 5 : operation === 6 ? 3 : 4); technique += 1) {
        expect(transform).toMatch(new RegExp(`Technique ${operation}\\.${technique}\\b`));
      }
    }
    expect(transform).toContain("Trimming");
    expect(transform).toContain("Separation in Time");
    expect(transform).toContain("Separation in State/Data");
    expect(transform).toContain("Separation in Operating Condition");
    expect(transform).toContain("Separation across System Boundary");
  });

  it("defines diverse candidate generation and the nine-box operator", () => {
    const explore = readRule("40-explore.md");

    for (const principle of [
      "Time",
      "State/Data",
      "Operating Condition",
      "System Boundary",
    ]) {
      expect(explore).toContain(principle);
    }
    expect(explore).toContain("9-box");
    expect(explore).toContain("SPACE-");
    expect(explore).toContain("CAN-01");
    expect(explore).toContain("CAN-02");
    expect(explore).toContain("CAN-03");
  });

  it("defines low-cost discriminating tests for unknowns", () => {
    const knowledge = readRule("50-knowledge.md");

    for (const contract of [
      "UNK-",
      "EVDREQ-",
      "discriminating",
      "lowest-cost",
      "research",
      "prototype",
      "falsification",
    ]) {
      expect(knowledge.toLowerCase()).toContain(contract.toLowerCase());
    }
  });
});
