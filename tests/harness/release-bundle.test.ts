import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ReleaseError,
  ReleaseRegistry,
  type ChangeImpactReceipt,
  type ComponentInput,
} from "../../src/harness/release-bundle.js";

const sha256 = (content: string): string =>
  `sha256:${createHash("sha256").update(content).digest("hex")}`;

const component = (
  componentId: string,
  overrides: Partial<ComponentInput> = {},
): ComponentInput => ({
  componentId,
  role: componentId.startsWith("contract") ? "method-contract" : "teaching-skill",
  owner: "method",
  version: "1.0.0",
  content: `${componentId}-bytes-v1`,
  compatibilityEvidenceRef: `evidence/${componentId}@1.0.0.json`,
  ...overrides,
});

const baseComponents = (): ComponentInput[] => [
  component("contract-mc-1"),
  component("skill-teach-methodology", { owner: "method", version: "1.2.0" }),
  component("adapter-ariadne", { role: "adapter", owner: "ariadne" }),
];

const impactFor = (
  bundleId: string,
  componentId: string,
  affectedConsumers: string[],
): ChangeImpactReceipt => ({
  receiptId: `CIR-owner-method-${componentId}-${affectedConsumers.length}`,
  issuedBy: "owner://method",
  bundleId,
  componentId,
  changedSurface: "normative surface changed by the owner",
  affectedConsumers,
  requiredCompatibilityEvidence: ["evidence/compat-for-change.json"],
});

const expectReason = (reason: ReleaseError["reason"], fn: () => void): void => {
  try {
    fn();
    expect.unreachable(`expected ${reason}`);
  } catch (error) {
    expect((error as ReleaseError).reason).toBe(reason);
  }
};

describe("federated Tested Release Bundle", () => {
  it("pins one exact owner version and digest per component with tuple evidence", () => {
    const registry = new ReleaseRegistry();
    const bundle = registry.assemble("bundle-1", baseComponents(), "evidence/tuple-compat.json");

    expect(bundle.status).toBe("draft");
    expect(bundle.pins.map((pin) => pin.digest)).toEqual(
      baseComponents().map((input) => sha256(input.content)),
    );
    for (const pin of Object.freeze(bundle.pins)) {
      expect(Object.isFrozen(pin)).toBe(true);
      expect(pin.version).toBeTruthy();
      expect(pin.compatibilityEvidenceRef).toMatch(/^evidence\//);
    }
    expect(bundle.combinationEvidenceRef).toBe("evidence/tuple-compat.json");
  });

  it("stays non-normative and never mutates owner-published inputs or lifecycle authority", () => {
    const registry = new ReleaseRegistry();
    const components = baseComponents();
    const bundle = registry.assemble("bundle-1", components, "evidence/tuple-compat.json");

    // Owner bumps a version after assembly; the pinned snapshot is untouched.
    components[0].version = "9.9.9";
    components[0].content = "tampered";
    expect(bundle.pins[0].version).toBe("1.0.0");
    expect(bundle.pins[0].digest).toBe(sha256("contract-mc-1-bytes-v1"));

    expect(bundle.normative).toBe(false);
    expect(bundle.format).toBe("release-bundle/1");
  });

  it("publishes only when every pin and the tuple itself carry compatibility evidence", () => {
    const registry = new ReleaseRegistry();
    const missingEvidence = [
      component("contract-mc-1"),
      {
        componentId: "skill-x",
        role: "teaching-skill",
        owner: "method",
        version: "1.0.0",
        content: "bytes",
      },
    ] as unknown as ComponentInput[];
    registry.assemble("bundle-bad-pin", missingEvidence, "evidence/tuple-compat.json");
    expectReason("evidence_missing", () => registry.publish("bundle-bad-pin", []));

    const noTupleEvidence = baseComponents();
    registry.assemble(
      "bundle-bad-tuple",
      noTupleEvidence,
      "",
    );
    expectReason("evidence_missing", () => registry.publish("bundle-bad-tuple", []));

    registry.assemble("bundle-1", baseComponents(), "evidence/tuple-compat.json");
    registry.publish("bundle-1", []);
    expect(registry.get("bundle-1")?.status).toBe("active");
  });

  it("records an owner-issued Change Impact Receipt naming surface, consumers, and required evidence", () => {
    const registry = new ReleaseRegistry();
    registry.assemble("bundle-1", baseComponents(), "evidence/tuple-compat.json");

    const unsigned = impactFor("bundle-1", "contract-mc-1", ["consumer-cli"]);
    delete (unsigned as Partial<ChangeImpactReceipt>).issuedBy;
    expectReason("evidence_missing", () => registry.recordChangeImpact(unsigned));

    const impact = impactFor("bundle-1", "contract-mc-1", ["consumer-cli", "consumer-harness"]);
    impact.changedSurface = "rules[].action vocabulary";
    registry.recordChangeImpact(impact);

    const successor = registry.prepareSuccessor("bundle-1", impact, [
      component("contract-mc-1", {
        version: "1.1.0",
        content: "v2-bytes",
        compatibilityEvidenceRef: impact.requiredCompatibilityEvidence[0],
      }),
    ]);
    expect(successor.impactReceiptId).toBe(impact.receiptId);

    // A receipt nobody recorded cannot drive a successor.
    const unrecorded = impactFor("bundle-1", "adapter-ariadne", []);
    unrecorded.receiptId = "CIR-forged";
    expectReason("evidence_missing", () =>
      registry.prepareSuccessor("bundle-1", unrecorded, [
        component("adapter-ariadne", { role: "adapter", owner: "ariadne", version: "2.0.0" }),
      ]),
    );
  });

  it("waits for every affected consumer receipt while unaffected owners retain their pins", () => {
    const registry = new ReleaseRegistry();
    registry.assemble("bundle-1", baseComponents(), "evidence/tuple-compat.json");
    registry.publish("bundle-1", []);
    const impact = impactFor("bundle-1", "contract-mc-1", ["consumer-cli", "consumer-harness"]);
    impact.changedSurface = "completion profile keys";
    registry.recordChangeImpact(impact);

    const successor = registry.prepareSuccessor("bundle-1", impact, [
      component("contract-mc-1", {
        version: "1.1.0",
        content: "contract-mc-1-bytes-v2",
        compatibilityEvidenceRef: impact.requiredCompatibilityEvidence[0],
      }),
    ]);

    // Unaffected owners retain their exact pins.
    const retainedAdapter = successor.pins.find((pin) => pin.componentId === "adapter-ariadne");
    const originalAdapter = registry
      .get("bundle-1")
      ?.pins.find((pin) => pin.componentId === "adapter-ariadne");
    expect(retainedAdapter).toEqual(originalAdapter);
    expect(successor.pins.find((pin) => pin.componentId === "contract-mc-1")?.version).toBe("1.1.0");

    // Publication waits until both affected consumers have receipted.
    try {
      registry.publish(successor.bundleId, ["consumer-cli"]);
      expect.unreachable("expected publication_waiting");
    } catch (error) {
      expect((error as ReleaseError).message).toContain(
        "waits for consumer receipts: consumer-harness",
      );
    }
    registry.publish(successor.bundleId, ["consumer-cli", "consumer-harness"]);
    expect(registry.get(successor.bundleId)?.status).toBe("active");
    expect(registry.activeBundleId()).toBe(successor.bundleId);
  });

  it("drains nonterminal attempts under original pins while new attempts use the successor", () => {
    const registry = new ReleaseRegistry();
    registry.assemble("bundle-old", baseComponents(), "evidence/tuple-compat.json");
    registry.publish("bundle-old", []);
    registry.registerAttempt("bundle-old", "attempt-a01");

    const impact = impactFor("bundle-old", "adapter-ariadne", ["consumer-harness"]);
    registry.recordChangeImpact(impact);
    const successor = registry.prepareSuccessor("bundle-old", impact, [
      component("adapter-ariadne", {
        role: "adapter",
        owner: "ariadne",
        version: "1.1.0",
        compatibilityEvidenceRef: impact.requiredCompatibilityEvidence[0],
      }),
    ]);
    registry.publish(successor.bundleId, ["consumer-harness"]);

    // New attempts land on the active successor...
    expect(registry.activeBundleId()).toBe(successor.bundleId);
    registry.registerAttempt(successor.bundleId, "attempt-a02");

    // ...while the old attempt drains under its original pins.
    expect(registry.undrainedAttempts("bundle-old")).toEqual(["attempt-a01"]);
    registry.drainAttempt("bundle-old", "attempt-a01");
    expect(registry.undrainedAttempts("bundle-old")).toEqual([]);
  });

  it("retires only with successor, expiry, approvals, drained attempts, and cleanup evidence", () => {
    const at = (iso: string): Date => new Date(iso);
    const registry = new ReleaseRegistry();
    registry.assemble("bundle-old", baseComponents(), "evidence/tuple-compat.json");
    registry.publish("bundle-old", []);
    registry.registerAttempt("bundle-old", "attempt-a01");
    const impact = impactFor("bundle-old", "contract-mc-1", ["consumer-cli"]);
    registry.recordChangeImpact(impact);
    const successor = registry.prepareSuccessor("bundle-old", impact, [
      component("contract-mc-1", {
        version: "1.1.0",
        content: "v2-bytes",
        compatibilityEvidenceRef: impact.requiredCompatibilityEvidence[0],
      }),
    ]);
    registry.publish(successor.bundleId, ["consumer-cli"]);
    registry.deprecate("bundle-old", "2026-08-20T00:00:00Z");

    expectReason("not_deprecated", () => registry.retire("bundle-old", "cleanup://done", () => at("2026-08-19T00:00:00Z")));
    expectReason("approvals_missing", () => registry.retire("bundle-old", "cleanup://done", () => at("2026-08-21T00:00:00Z")));

    registry.approve("bundle-old", "owner://approval/retire-bundle-old");
    expectReason("attempts_undrained", () =>
      registry.retire("bundle-old", "cleanup://done", () => at("2026-08-21T00:00:00Z")),
    );
    registry.drainAttempt("bundle-old", "attempt-a01");

    // Affected consumers must migrate before retirement.
    expectReason("consumers_unmigrated", () =>
      registry.retire("bundle-old", "cleanup://done", () => at("2026-08-21T00:00:00Z")),
    );
    registry.recordConsumerMigration("bundle-old", "consumer-cli");

    expectReason("cleanup_evidence_missing", () => registry.retire("bundle-old", "", () => at("2026-08-21T00:00:00Z")));
    registry.retire("bundle-old", "cleanup://retire-bundle-old-executed", () => at("2026-08-21T00:00:00Z"));
    expect(registry.get("bundle-old")?.status).toBe("retired");

    expectReason("already_retired", () => registry.retire("bundle-old", "cleanup://again"));

    // Historical manifest stays resolvable after retirement.
    expect(registry.get("bundle-old")?.pins.length).toBe(3);
  });

  it("keeps retirement impossible without an active successor and duplicate ids taken", () => {
    const registry = new ReleaseRegistry();
    registry.assemble("lonely", baseComponents(), "evidence/tuple-compat.json");
    expectReason("bundle_id_taken", () =>
      registry.assemble("lonely", baseComponents(), "evidence/tuple-compat.json"),
    );
    registry.publish("lonely", []);
    registry.deprecate("lonely", "2026-01-01T00:00:00Z");
    registry.approve("lonely", "owner://approval/x");
    expectReason("successor_missing", () =>
      registry.retire("lonely", "cleanup://x", () => new Date("2027-01-01T00:00:00Z")),
    );
  });
});
