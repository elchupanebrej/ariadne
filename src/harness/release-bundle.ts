import { sha256Digest } from "../adapters/lifecycle.js";

export type BundleStatus = "draft" | "active" | "deprecated" | "retired";

// The bundle is a non-normative compatibility snapshot: it never owns the
// components it pins and preserves owner lifecycle authority.
export interface ComponentPin {
  componentId: string;
  role: string;
  owner: string;
  version: string;
  digest: string;
  compatibilityEvidenceRef: string;
}

export interface ReleaseBundle {
  format: "release-bundle/1";
  bundleId: string;
  normative: false;
  status: BundleStatus;
  pins: readonly ComponentPin[];
  /** Evidence that THIS tuple of pinned versions passed together. */
  combinationEvidenceRef: string;
  predecessorBundleId?: string;
  impactReceiptId?: string;
  deprecationExpiresAt?: string;
  approvals: readonly string[];
}

export interface ChangeImpactReceipt {
  receiptId: string;
  issuedBy: string;
  bundleId: string;
  componentId: string;
  changedSurface: string;
  affectedConsumers: readonly string[];
  requiredCompatibilityEvidence: readonly string[];
}

export class ReleaseError extends Error {
  constructor(
      readonly reason:
      | "bundle_not_found"
      | "bundle_id_taken"
      | "component_not_changed"
      | "duplicate_component"
      | "evidence_missing"
      | "publication_waiting"
      | "not_active"
      | "not_deprecated"
      | "successor_missing"
      | "approvals_missing"
      | "attempts_undrained"
      | "consumers_unmigrated"
      | "cleanup_evidence_missing"
      | "already_retired",
    message: string,
  ) {
    super(message);
  }
}

// The pin carries everything except the digest, which is computed over the
// exact published artifact bytes.
export type ComponentInput = Omit<ComponentPin, "digest"> & { content: string };

const pinOf = (input: ComponentInput): ComponentPin => {
  const { content, ...pin } = input;
  return Object.freeze({ ...pin, digest: `sha256:${sha256Digest(content)}` });
};

export class ReleaseRegistry {
  private readonly bundles = new Map<string, ReleaseBundle>();
  private readonly impacts = new Map<string, ChangeImpactReceipt>();
  private readonly activeAttempts = new Map<string, Set<string>>();
  private readonly migratedConsumers = new Map<string, Set<string>>();
  private readonly publishedAt = new Map<string, number>();
  private sequence = 0;

  assemble(
    bundleId: string,
    components: ComponentInput[],
    combinationEvidenceRef: string,
  ): ReleaseBundle {
    if (this.bundles.has(bundleId)) {
      throw new ReleaseError("bundle_id_taken", `Bundle id already used: ${bundleId}`);
    }
    const duplicate = components.find(
      (component, index) => components.findIndex((other) => other.componentId === component.componentId) !== index,
    );
    if (duplicate) {
      throw new ReleaseError("duplicate_component", `Component pinned twice: ${duplicate.componentId}`);
    }
    const bundle: ReleaseBundle = {
      format: "release-bundle/1",
      bundleId,
      normative: false,
      status: "draft",
      pins: Object.freeze(components.map(pinOf)),
      combinationEvidenceRef,
      approvals: [],
    };
    this.bundles.set(bundleId, bundle);
    return bundle;
  }

  get(bundleId: string): ReleaseBundle | undefined {
    // Historical manifests stay resolvable after retirement.
    return this.bundles.get(bundleId);
  }

  private require(bundleId: string): ReleaseBundle {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) throw new ReleaseError("bundle_not_found", `Unknown bundle: ${bundleId}`);
    return bundle;
  }

  // Records an OWNER-ISSUED impact receipt; the registry never fabricates
  // change statements on an owner's behalf.
  recordChangeImpact(receipt: ChangeImpactReceipt): void {
    const bundle = this.require(receipt.bundleId);
    if (!receipt.issuedBy?.trim() || !receipt.receiptId?.trim()) {
      throw new ReleaseError("evidence_missing", "Impact receipt must name its issuer and id");
    }
    this.impacts.set(receipt.receiptId, receipt);
    // The changed bundle carries the receipt so retirement can later verify
    // consumer migration against it.
    this.bundles.set(bundle.bundleId, { ...bundle, impactReceiptId: receipt.receiptId });
  }

  getImpact(receiptId: string): ChangeImpactReceipt | undefined {
    // Receipts remain resolvable even after their bundle retires.
    return this.impacts.get(receiptId);
  }

  // The successor keeps every unaffected pin verbatim; only the components
  // named by the caller move to their new owner-published versions.
  prepareSuccessor(
    predecessorBundleId: string,
    impact: ChangeImpactReceipt,
    changedComponents: ComponentInput[],
  ): ReleaseBundle {
    const predecessor = this.require(predecessorBundleId);
    if (this.impacts.get(impact.receiptId) !== impact) {
      throw new ReleaseError("evidence_missing", `Unknown impact receipt ${impact.receiptId}`);
    }
    const successorId = `${predecessorBundleId}-r${this.sequence + 1}`;
    this.sequence += 1;
    const changedIds = new Set(changedComponents.map((component) => component.componentId));
    if (!changedIds.has(impact.componentId)) {
      throw new ReleaseError("component_not_changed", `Successor must repin the changed component ${impact.componentId}`);
    }
    const retained = predecessor.pins.filter((pin) => !changedIds.has(pin.componentId));
    const bundle: ReleaseBundle = {
      format: "release-bundle/1",
      bundleId: successorId,
      normative: false,
      status: "draft",
      pins: Object.freeze([...retained, ...changedComponents.map(pinOf)]),
      combinationEvidenceRef: predecessor.combinationEvidenceRef,
      predecessorBundleId,
      impactReceiptId: impact.receiptId,
      approvals: [],
    };
    this.bundles.set(successorId, bundle);
    return bundle;
  }

  publish(bundleId: string, consumerReceipts: string[]): void {
    const bundle = this.require(bundleId);
    if (bundle.status !== "draft") {
      throw new ReleaseError("publication_waiting", `Bundle ${bundleId} is ${bundle.status}, not draft`);
    }
    for (const pin of bundle.pins) {
      if (!pin.compatibilityEvidenceRef) {
        throw new ReleaseError("evidence_missing", `Component ${pin.componentId} lacks compatibility evidence`);
      }
    }
    if (!bundle.combinationEvidenceRef) {
      throw new ReleaseError(
        "evidence_missing",
        `Bundle ${bundleId} lacks combination evidence that this tuple passed together`,
      );
    }
    if (bundle.impactReceiptId) {
      const impact = this.impacts.get(bundle.impactReceiptId);
      // Every piece of evidence the owner named must be attached somewhere on
      // the successor: a pin's own compatibility evidence or the tuple's.
      for (const required of impact?.requiredCompatibilityEvidence ?? []) {
        const covered =
          bundle.combinationEvidenceRef === required ||
          bundle.pins.some((pin) => pin.compatibilityEvidenceRef === required);
        if (!covered) {
          throw new ReleaseError(
            "evidence_missing",
            `Required compatibility evidence not attached: ${required}`,
          );
        }
      }
      const waiting = this.waitingConsumers(bundle, consumerReceipts);
      if (waiting.length > 0) {
        throw new ReleaseError(
          "publication_waiting",
          `Publication waits for consumer receipts: ${waiting.join(", ")}`,
        );
      }
    }
    this.sequence += 1;
    this.publishedAt.set(bundleId, this.sequence);
    this.bundles.set(bundleId, { ...bundle, status: "active" });
    // ponytail: several bundles can be active at once; activeBundleId returns
    // the most recently published one. Explicit deprecation resolves order.
    this.activeAttempts.set(bundleId, new Set());
  }

  waitingConsumers(bundle: ReleaseBundle, consumerReceipts: string[]): string[] {
    if (!bundle.impactReceiptId) return [];
    const impact = this.impacts.get(bundle.impactReceiptId);
    if (!impact) return [];
    const received = new Set(consumerReceipts);
    return impact.affectedConsumers.filter((consumer) => !received.has(consumer));
  }

  activeBundleId(): string | undefined {
    let latest: string | undefined;
    let latestPublishedAt = -1;
    for (const [id, bundle] of this.bundles) {
      if (bundle.status !== "active") continue;
      const publishedAt = this.publishedAt.get(id) ?? 0;
      if (publishedAt >= latestPublishedAt) {
        latest = id;
        latestPublishedAt = publishedAt;
      }
    }
    return latest;
  }

  registerAttempt(bundleId: string, attemptId: string): void {
    const bundle = this.require(bundleId);
    if (bundle.status !== "active") {
      throw new ReleaseError(
        "not_active",
        `New attempts use the active successor; bundle ${bundleId} is ${bundle.status}`,
      );
    }
    if (!this.activeAttempts.has(bundleId)) this.activeAttempts.set(bundleId, new Set());
    this.activeAttempts.get(bundleId)!.add(attemptId);
  }

  deprecate(bundleId: string, deprecationExpiresAt: string): void {
    const bundle = this.require(bundleId);
    this.bundles.set(bundleId, { ...bundle, status: "deprecated", deprecationExpiresAt });
  }

  approve(bundleId: string, approvalRef: string): void {
    const bundle = this.require(bundleId);
    this.bundles.set(bundleId, {
      ...bundle,
      approvals: [...bundle.approvals, approvalRef],
    });
  }

  recordConsumerMigration(bundleId: string, consumer: string): void {
    this.require(bundleId);
    if (!this.migratedConsumers.has(bundleId)) this.migratedConsumers.set(bundleId, new Set());
    this.migratedConsumers.get(bundleId)!.add(consumer);
  }

  migratedConsumersOf(bundleId: string): string[] {
    return [...(this.migratedConsumers.get(bundleId) ?? [])];
  }

  // A nonterminal attempt drains under its ORIGINAL pins; there is no
  // in-place upgrade path.
  drainAttempt(bundleId: string, attemptId: string): void {
    this.activeAttempts.get(bundleId)?.delete(attemptId);
  }

  undrainedAttempts(bundleId: string): string[] {
    return [...(this.activeAttempts.get(bundleId) ?? [])];
  }

  retire(bundleId: string, cleanupEvidenceRef: string, now: () => Date = () => new Date()): void {
    const bundle = this.require(bundleId);
    if (bundle.status === "retired") {
      throw new ReleaseError("already_retired", `Bundle ${bundleId} is already retired`);
    }
    if (bundle.status !== "deprecated" || !bundle.deprecationExpiresAt) {
      throw new ReleaseError("not_deprecated", `Bundle ${bundleId} must be deprecated with an expiry first`);
    }
    if (now() <= new Date(bundle.deprecationExpiresAt)) {
      throw new ReleaseError("not_deprecated", `Deprecation of ${bundleId} has not expired`);
    }
    if (!this.hasActiveSuccessor(bundleId)) {
      throw new ReleaseError("successor_missing", `Retirement of ${bundleId} requires an active successor`);
    }
    if (bundle.approvals.length === 0) {
      throw new ReleaseError("approvals_missing", `Retirement of ${bundleId} requires an owner approval`);
    }
    const undrained = this.undrainedAttempts(bundleId);
    if (undrained.length > 0) {
      throw new ReleaseError("attempts_undrained", `Bundle ${bundleId} still has attempts: ${undrained.join(", ")}`);
    }
    const impact = bundle.impactReceiptId ? this.impacts.get(bundle.impactReceiptId) : undefined;
    if (impact) {
      const migrated = new Set(this.migratedConsumersOf(bundleId));
      const unmigrated = impact.affectedConsumers.filter((consumer) => !migrated.has(consumer));
      if (unmigrated.length > 0) {
        throw new ReleaseError(
          "consumers_unmigrated",
          `Bundle ${bundleId} consumers not migrated: ${unmigrated.join(", ")}`,
        );
      }
    }
    if (!cleanupEvidenceRef) {
      throw new ReleaseError("cleanup_evidence_missing", `Retirement of ${bundleId} requires executable cleanup evidence`);
    }
    this.bundles.set(bundleId, { ...bundle, status: "retired" });
  }

  private hasActiveSuccessor(bundleId: string): boolean {
    for (const bundle of this.bundles.values()) {
      if (
        bundle.status === "active" &&
        bundle.predecessorBundleId === bundleId
      ) {
        return true;
      }
    }
    return false;
  }
}
