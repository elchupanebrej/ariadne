import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rulesRoot = fileURLToPath(
  new URL("../../.agents/skills/ariadne/rules/", import.meta.url),
);

const readRule = (name: string) =>
  readFileSync(`${rulesRoot}/${name}`, "utf8");

describe("Ariadne operation rules", () => {
  it("publishes frame and diagnose rule entrypoints", () => {
    expect(existsSync(`${rulesRoot}/10-frame.md`)).toBe(true);
    expect(existsSync(`${rulesRoot}/20-diagnose.md`)).toBe(true);
  });

  it("defines the public frame artifact and separation contract", () => {
    const frame = readRule("10-frame.md").toLowerCase();

    for (const contract of [
      "FRAME-",
      "Behavioral Requirement",
      "Proposed Mechanism",
      "Hoare",
      "observable",
      "technology-agnostic",
    ]) {
      expect(frame).toContain(contract.toLowerCase());
    }
  });

  it("defines falsifiable diagnosis and differential hypotheses", () => {
    const diagnose = readRule("20-diagnose.md");

    for (const contract of [
      "HYP-",
      "Causal Hypothesis",
      "causal DAG",
      "differential",
      "falsification",
      "EVDREQ-",
    ]) {
      expect(diagnose).toContain(contract);
    }
  });
});
