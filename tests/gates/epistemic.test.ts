import { describe, expect, it } from "vitest";
import { NodeSchema, type Node } from "../../src/core/schemas/nodes.js";
import { runEpistemicGate } from "../../src/gates/epistemic-gate.js";
import type { MaterializedGraph } from "../../src/graph/storage.js";

const node = (
  id: string,
  type: Node["type"],
  provenance_type: Node["provenance_type"],
  extra: Record<string, unknown> = {},
): Node =>
  NodeSchema.parse({
    id,
    type,
    provenance_type,
    statement: id,
    ...extra,
  });

const graph = (
  nodes: Node[],
  edges: MaterializedGraph["edges"] = [],
): MaterializedGraph => ({ nodes, edges });

describe("runEpistemicGate", () => {
  it("rejects a unit-test result for a throughput claim", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "Throughput & Latency",
            minimum_rung: 7,
          }),
          node("EVD-1", "EVD", "MEASURED", {
            method: "unit test",
            rung: 3,
            verdict: "SUPPORTED",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSUFFICIENT_EVIDENCE",
          requestId: "EVDREQ-1",
          evidenceId: "EVD-1",
          required: 7,
          actual: 3,
        }),
      ]),
    );
  });

  it("accepts evidence at the minimum mapped rung", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "ThroughputCapacity",
          }),
          node("EVD-1", "EVD", "MEASURED", {
            rung: 7,
            verdict: "SUPPORTED",
            method: "load benchmark",
            receipt: "receipt-1",
            environment: "ci-node-20",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("keeps a request override from lowering the claim-class minimum", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "Throughput & Latency",
            minimum_rung: 7,
            required_rung: 2,
          }),
          node("EVD-1", "EVD", "MEASURED", {
            rung: 2,
            verdict: "SUPPORTED",
            method: "unit test",
            receipt: "receipt-1",
            environment: "ci-node-20",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INSUFFICIENT_EVIDENCE",
          required: 7,
          actual: 2,
        }),
      ]),
    );
  });

  it("does not accept request-only rung fields as evidence and rejects incompatible methods", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("EVDREQ-1", "EVDREQ", "PROPOSED", {
            claim_class: "Throughput & Latency",
          }),
          node("EVD-1", "EVD", "MEASURED", {
            minimum_rung: 7,
            verdict: "SUPPORTED",
            method: "unit test",
            receipt: "receipt-1",
            environment: "ci-node-20",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_EVIDENCE_RUNG" }),
        expect.objectContaining({ code: "INCOMPATIBLE_EVIDENCE_METHOD" }),
      ]),
    );
  });

  it("uses a referenced claim class when the request omits one", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("CLM-1", "CLM", "PROPOSED", { claim_class: "Throughput & Latency" }),
          node("EVDREQ-1", "EVDREQ", "PROPOSED", { claim: "CLM-1" }),
          node("EVD-1", "EVD", "MEASURED", {
            rung: 7,
            verdict: "SUPPORTED",
            method: "load benchmark",
            receipt: "receipt-1",
            environment: "ci-node-20",
          }),
        ],
        [{ source: "EVD-1", target: "EVDREQ-1", type: "answers" }],
      ),
    );

    expect(result).toEqual({ passed: true, diagnostics: [] });
  });

  it("rejects a locked decision that depends on ASSUMED or UNKNOWN provenance", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("DEC-1", "DEC", "DECIDED", { adversarial_critique: "Reviewed" }),
          node("ASM-1", "ASM", "ASSUMED"),
          node("UNK-1", "UNK", "UNKNOWN"),
        ],
        [
          { source: "DEC-1", target: "ASM-1", type: "depends_on" },
          { source: "DEC-1", target: "UNK-1", type: "depends_on" },
        ],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNRESOLVED_DECISION_DEPENDENCY",
          nodeId: "DEC-1",
          dependencyId: "ASM-1",
        }),
        expect.objectContaining({ dependencyId: "UNK-1" }),
      ]),
    );
  });

  it("suggests a provenance downgrade when DERIVED depends on an unresolved premise", () => {
    const result = runEpistemicGate(
      graph(
        [node("FRAME-1", "FRAME", "DERIVED"), node("UNK-1", "UNK", "UNKNOWN")],
        [{ source: "FRAME-1", target: "UNK-1", type: "depends_on" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_DERIVED_PROVENANCE",
          nodeId: "FRAME-1",
          dependencyId: "UNK-1",
          message:
            "FRAME-1 cannot be DERIVED from UNK-1 with UNKNOWN provenance; downgrade FRAME-1 provenance to ASSUMED/PROPOSED until UNK-1 resolves",
        }),
      ]),
    );
  });

  it("keeps the no-antecedents message distinct from the downgrade hint", () => {
    const result = runEpistemicGate(graph([node("CLM-1", "CLM", "DERIVED")]));

    expect(result.diagnostics).toEqual([
      {
        code: "INVALID_DERIVED_PROVENANCE",
        message: "CLM-1 cannot claim DERIVED provenance without antecedent dependencies",
        nodeId: "CLM-1",
      },
    ]);
  });

  it("requires a non-empty adversarial critique before locking DEC or CAN", () => {
    const result = runEpistemicGate(
      graph([
        node("DEC-1", "DEC", "DECIDED"),
        node("CAN-1", "CAN", "DECIDED", { adversarial_critique: "  " }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_ADVERSARIAL_CRITIQUE", nodeId: "DEC-1" }),
        expect.objectContaining({ code: "MISSING_ADVERSARIAL_CRITIQUE", nodeId: "CAN-1" }),
      ]),
    );
  });

  it("blocks dependencies on reopened and stale decisions", () => {
    const result = runEpistemicGate(
      graph(
        [
          node("DEC-1", "DEC", "DECIDED", {
            status: "RE-OPENED",
            adversarial_critique: "Reviewed",
          }),
          node("DEC-2", "DEC", "DECIDED", { adversarial_critique: "Reviewed" }),
        ],
        [{ source: "DEC-2", target: "DEC-1", type: "depends_on" }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_DEPENDENCY_STATUS",
          dependencyId: "DEC-1",
        }),
      ]),
    );
  });

  it("requires a parseable deadline and consistent TRANS lifecycle aliases", () => {
    const transition = {
      id: "TRANS-1",
      type: "TRANS",
      provenance_type: "PROPOSED",
      statement: "temporary path",
      target_mechanism_ref: "CAN-1",
      retirement_predicate: "legacy path is unused",
      expiration_deadline: "not-a-date",
      cleanup_verification_test: "npm test -- cleanup",
      owner: "platform",
      lifecycle_state: "PROPOSED",
      transition_lifecycle: "EXPANDED",
    };

    expect(NodeSchema.safeParse(transition).success).toBe(false);
    expect(
      NodeSchema.safeParse({
        ...transition,
        expiration_deadline: "2099-01-01",
        transition_lifecycle: "PROPOSED",
      }).success,
    ).toBe(true);
  });

  it.each([
    "INVALIDATED",
    "FALSIFIED",
    "STALE",
    "RE-OPENED",
    "RE_OPENED",
    "REQUIRES_REVALUATION",
    "BLOCKED",
    "NEEDS_REVIEW",
  ])("blocks a TRANS with hard status %s", (status) => {
    const result = runEpistemicGate(
      graph([
        node("CAN-1", "CAN", "PROPOSED"),
        node("TRANS-1", "TRANS", "PROPOSED", {
          status,
          target_mechanism_ref: "CAN-1",
          retirement_predicate: "legacy path is unused",
          expiration_deadline: "2099-01-01",
          cleanup_verification_test: "npm test -- cleanup",
          owner: "platform",
          lifecycle_state: "PROPOSED",
        }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TRANSITION_BLOCKED",
          nodeId: "TRANS-1",
        }),
      ]),
    );
  });

  it.each([
    "INVALIDATED",
    "FALSIFIED",
    "STALE",
    "RE-OPENED",
    "RE_OPENED",
    "REQUIRES_REVALUATION",
    "BLOCKED",
    "NEEDS_REVIEW",
  ])("blocks a TRANS targeting a hard-status CAN %s", (status) => {
    const result = runEpistemicGate(
      graph([
        node("CAN-1", "CAN", "PROPOSED", { status }),
        node("TRANS-1", "TRANS", "PROPOSED", {
          target_mechanism_ref: "CAN-1",
          retirement_predicate: "legacy path is unused",
          expiration_deadline: "2099-01-01",
          cleanup_verification_test: "npm test -- cleanup",
          owner: "platform",
          lifecycle_state: "PROPOSED",
        }),
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "INVALID_TRANSITION",
          nodeId: "TRANS-1",
        }),
      ]),
    );
  });
});
