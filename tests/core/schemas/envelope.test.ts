import { describe, expect, it } from "vitest";
import {
  AriadneEpistemicEnvelope,
  EPISTEMIC_MODES,
  SENDER_ROLES,
} from "../../../src/core/schemas/envelope.js";
import { exportEnvelopeJsonSchema } from "../../../src/core/schemas/json-schema-export.js";

const envelope = () => ({
  envelope_id: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  correlation_id: "TASK-ORDER-LEAK-402",
  timestamp: "2026-08-20T19:35:00Z",
  sender_role: "DiagnosticAgent",
  target_role: "VerificationAgent",
  epistemic_mode: "Standard",
  provenance_payload: {
    node_id: "EVDREQ-012",
    provenance_type: "PROPOSED",
    statement: "Measure connection pool utilization under load.",
    confidence_level: 0.5,
    dependencies: ["HYP-004"],
    falsification_conditions: ["Pool remains below saturation."],
  },
});

describe("Ariadne epistemic envelope", () => {
  it("accepts the normative v5 envelope shape", () => {
    expect(AriadneEpistemicEnvelope.safeParse(envelope()).success).toBe(true);
  });

  it("exposes the canonical roles and modes", () => {
    expect(SENDER_ROLES).toHaveLength(8);
    expect(EPISTEMIC_MODES).toEqual(["Fast", "Standard", "Deep"]);
  });

  it.each([
    "sender_role",
    "target_role",
    "provenance_payload",
  ])("rejects an envelope missing %s", (field) => {
    const invalid = { ...envelope() } as Record<string, unknown>;
    delete invalid[field];
    expect(AriadneEpistemicEnvelope.safeParse(invalid).success).toBe(false);
  });

  it("rejects malformed IDs, roles, modes, and provenance payloads", () => {
    expect(
      AriadneEpistemicEnvelope.safeParse({
        ...envelope(),
        envelope_id: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      AriadneEpistemicEnvelope.safeParse({
        ...envelope(),
        sender_role: "UnknownAgent",
      }).success,
    ).toBe(false);
    expect(
      AriadneEpistemicEnvelope.safeParse({
        ...envelope(),
        provenance_payload: {
          ...envelope().provenance_payload,
          node_id: "not-a-node",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects confidence values outside the JSON Schema bounds", () => {
    expect(
      AriadneEpistemicEnvelope.safeParse({
        ...envelope(),
        provenance_payload: {
          ...envelope().provenance_payload,
          confidence_level: 1.1,
        },
      }).success,
    ).toBe(false);
  });
});

describe("epistemic envelope JSON Schema", () => {
  it("exports draft 2020-12 with the required fields", () => {
    const schema = exportEnvelopeJsonSchema();

    expect(schema.$schema).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
    expect(schema.title).toBe("AriadneEpistemicEnvelope");
    expect(schema.required).toEqual([
      "envelope_id",
      "correlation_id",
      "timestamp",
      "sender_role",
      "target_role",
      "epistemic_mode",
      "provenance_payload",
    ]);
  });
});
