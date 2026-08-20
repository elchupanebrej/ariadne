import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rulesRoot = fileURLToPath(
  new URL("../../.agents/skills/ariadne/rules/", import.meta.url),
);

const readRule = (name: string) =>
  readFileSync(`${rulesRoot}/${name}`, "utf8");

describe("Ariadne system operation rules", () => {
  it("publishes dependencies, dynamics, value, and validate entrypoints", () => {
    for (const name of [
      "60-dependencies.md",
      "70-dynamics.md",
      "80-value.md",
      "90-validate.md",
    ]) {
      expect(existsSync(`${rulesRoot}/${name}`)).toBe(true);
    }
  });

  it("defines change-radius coupling and dependency records", () => {
    const dependencies = readRule("60-dependencies.md");

    for (const contract of [
      "DEP-",
      "change radius",
      "schema coupling",
      "deployment coupling",
      "event coupling",
      "migration coupling",
      "data ownership",
    ]) {
      expect(dependencies.toLowerCase()).toContain(contract.toLowerCase());
    }
  });

  it("defines dynamic queues, retries, and metastable failures", () => {
    const dynamics = readRule("70-dynamics.md");

    for (const contract of [
      "DYN-",
      "Little's Law",
      "p99",
      "retry storm",
      "metastable",
      "version skew",
      "backpressure",
    ]) {
      expect(dynamics.toLowerCase()).toContain(contract.toLowerCase());
    }
  });

  it("defines hard-requirement filtering and transition lifecycle gates", () => {
    const value = readRule("80-value.md");
    const validate = readRule("90-validate.md");

    for (const contract of [
      "VAL-SELECT-",
      "hard requirement",
      "non-compensatory",
      "Adversarial Critique",
      "uncertainty",
    ]) {
      expect(value.toLowerCase()).toContain(contract.toLowerCase());
    }
    for (const state of [
      "PROPOSED",
      "EXPANDED",
      "DUAL_RUNNING",
      "MIGRATING",
      "CONTRACTED",
      "RETIRED",
    ]) {
      expect(validate).toContain(state);
    }
    for (const field of [
      "target_mechanism_ref",
      "retirement_predicate",
      "expiration_deadline",
      "cleanup_verification_test",
    ]) {
      expect(validate).toContain(field);
    }
  });
});
