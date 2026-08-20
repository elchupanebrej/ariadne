import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rulesRoot = fileURLToPath(
  new URL("../../.agents/skills/ariadne/rules/", import.meta.url),
);

const readRule = (name: string) =>
  readFileSync(`${rulesRoot}/${name}`, "utf8");

describe("Ariadne governance rules", () => {
  it("publishes every progressive-disclosure governance file", () => {
    for (const name of [
      "00-core.md",
      "evidence.md",
      "invalidation.md",
      "roles.md",
      "depth-modes.md",
      "agent-rules.md",
    ]) {
      expect(existsSync(`${rulesRoot}/${name}`)).toBe(true);
    }
  });

  it("contains the complete v5 evidence ladder and claim gate", () => {
    const evidence = readRule("evidence.md");

    for (let rung = 1; rung <= 10; rung += 1) {
      expect(evidence).toMatch(new RegExp(`Rung ${rung}\\b`));
    }
    for (const claimClass of [
      "Syntactic structure",
      "Algorithmic logic",
      "Test suite quality",
      "Boundary contract",
      "Throughput & Latency",
      "Distributed safety",
      "Migration safety",
      "Sustained reliability",
    ]) {
      expect(evidence).toContain(claimClass);
    }
    expect(evidence).toContain("MSI >= 85%");
  });

  it("defines all v5 roles, depth modes, and invariant rules", () => {
    const roles = readRule("roles.md");
    const depth = readRule("depth-modes.md");
    const agentRules = readRule("agent-rules.md");

    for (const role of [
      "FramingAgent",
      "DiagnosticAgent",
      "ExplorationAgent",
      "ArchitectureAgent",
      "DynamicsAgent",
      "ImplementationAgent",
      "VerificationAgent",
      "AdversarialReviewerAgent",
    ]) {
      expect(roles).toContain(role);
    }
    for (const mode of ["Fast", "Standard", "Deep"]) {
      expect(depth).toMatch(new RegExp(`\\b${mode}\\b`));
    }
    for (let rule = 1; rule <= 12; rule += 1) {
      expect(agentRules).toMatch(new RegExp(`Rule ${rule}\\b`));
    }
  });

  it("states the core provenance and invalidation contracts", () => {
    const core = readRule("00-core.md");
    const invalidation = readRule("invalidation.md");

    for (const provenance of [
      "UNKNOWN",
      "ASSUMED",
      "PROPOSED",
      "DERIVED",
      "MEASURED",
      "FACT",
      "DECIDED",
    ]) {
      expect(core).toContain(provenance);
    }
    expect(core).toContain("Weakest-Precondition Rule");
    expect(invalidation).toContain("FALSIFIED");
    expect(invalidation).toContain("NEEDS_REVIEW");
    expect(invalidation).toContain("Operational Notice");
  });
});
