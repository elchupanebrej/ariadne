import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const skillPath = fileURLToPath(
  new URL("../../.agents/skills/ariadne/SKILL.md", import.meta.url),
);

const operations = {
  frame: "10-frame.md",
  diagnose: "20-diagnose.md",
  transform: "30-transform.md",
  explore: "40-explore.md",
  knowledge: "50-knowledge.md",
  dependencies: "60-dependencies.md",
  dynamics: "70-dynamics.md",
  value: "80-value.md",
  validate: "90-validate.md",
};

describe("Ariadne root skill", () => {
  it("is a concise model-invoked router", () => {
    const skill = readFileSync(skillPath, "utf8");

    expect(skill.split(/\s+/u).filter(Boolean).length).toBeLessThan(300);
    expect(skill).toMatch(/^---[\s\S]*?description:\s*\S+[\s\S]*?---/u);
    expect(skill).not.toMatch(/^disable-model-invocation:/mu);
  });

  it("points each operation trigger at one targeted rule file", () => {
    const skill = readFileSync(skillPath, "utf8");

    for (const [operation, rule] of Object.entries(operations)) {
      expect(skill.toLowerCase()).toContain(operation);
      expect(skill).toContain(`rules/${rule}`);
    }
  });
});
