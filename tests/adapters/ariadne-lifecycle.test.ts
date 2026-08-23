import { describe, expect, it } from "vitest";
import {
  AriadneOwnerAdapter,
  type AriadneStartRequest,
} from "../../src/adapters/ariadne/lifecycle.js";

describe("10 — Ariadne owner lifecycle contract", () => {
  describe("1. Capability negotiation", () => {
    it("declares supported operations, artifact kinds, and versions", () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const caps = adapter.capabilities();

      expect(caps.adapterId).toBe("adapter://ariadne");
      expect(caps.adapterVersion).toBe("1.0.0");
      expect(caps.owner).toBe("ariadne");
      expect(caps.supportedOperations).toContain("start");
      expect(caps.supportedOperations).toContain("resume");
      expect(caps.supportedOperations).toContain("cancel");
      expect(caps.supportedOperations).toContain("events");
      expect(caps.supportedOperations).toContain("direct_import");

      // Ariadne-specific operations
      expect(caps.supportedOperations).toContain("preflight");
      expect(caps.supportedOperations).toContain("ingest");
      expect(caps.supportedOperations).toContain("gate");
      expect(caps.supportedOperations).toContain("invalidation");
      expect(caps.supportedOperations).toContain("handoff");

      expect(caps.supportedInteractionModes).toEqual(
        expect.arrayContaining(["headless"]),
      );
      expect(caps.supportedArtifactKinds).toEqual(
        expect.arrayContaining(["EVD", "EVDREQ", "graph_revision", "markdown"]),
      );
    });

    it("rejects dispatch for an unsupported Ariadne operation before execution", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const outcome = await adapter.start("harness://request/req-a01", {
        operation: "magic-unknown-op" as any,
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      expect(outcome.status).toBe("failed");
      expect(outcome.error).toMatch(/unsupported.*operation/i);
      expect(outcome.diagnosticRef).toMatch(
        /^adapter:\/\/diagnostic\/unsupported-/,
      );
      expect(outcome.pointers).toContainEqual(outcome.diagnosticRef);
    });
  });

  describe("2. Start, resume, cancel, and events exchange only pointers", () => {
    it("starts a preflight operation returning an external run reference", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const outcome = await adapter.start("harness://request/req-a02", {
        operation: "preflight",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      expect(outcome.status).toBe("running");
      expect(outcome.externalRunRef).toMatch(/^ariadne:\/\/run\/preflight-/);
      expect(outcome.eventCursor).toBe(1);
      expect(
        outcome.pointers.some((p) => p.startsWith("adapter://ariadne@sha256:")),
      ).toBe(true);
      expect(outcome.pointers).toContain("contract://method@sha256:m1");
      expect(outcome.pointers).toContain("workspace://repo@rev:w1");
      expect(outcome.pointers).toContain("ariadne://graph/rev-g1");
      expect(outcome.pointers).toContain(outcome.externalRunRef!);

      // No raw graph payload — all pointers must have valid schemes
      for (const ptr of outcome.pointers) {
        expect(ptr).toMatch(/^[a-z0-9_-]+:\/\/.+/i);
      }
    });

    it("resumes with input reference and emits monotonic events", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a03", {
        operation: "ingest",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
        inputRef: "file://matt/evidence.json@sha256:e1",
        evidenceReceiptRef: "matt://receipt/succeeded-1",
      });

      const runRef = startOutcome.externalRunRef!;

      const waitOutcome = await adapter.wait(
        runRef,
        "ariadne://pending/inspect-1",
        "ariadne://receipt/waiting-1",
      );
      expect(waitOutcome.status).toBe("waiting");
      expect(waitOutcome.pendingAction).toBe("ariadne://pending/inspect-1");
      expect(waitOutcome.pointers).toContain("ariadne://receipt/waiting-1");
      expect(waitOutcome.eventCursor).toBe(2);

      const resumeOutcome = await adapter.resume(
        runRef,
        "ariadne://answer/1",
        "ariadne://receipt/resumed-1",
      );
      expect(resumeOutcome.status).toBe("running");
      expect(resumeOutcome.pendingAction).toBeUndefined();
      expect(resumeOutcome.pointers).toContain("ariadne://answer/1");
      expect(resumeOutcome.pointers).toContain("ariadne://receipt/resumed-1");
      expect(resumeOutcome.eventCursor).toBe(3);
    });

    it("cancels an Ariadne run with pending-action until terminal receipt", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a04", {
        operation: "preflight",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      const runRef = startOutcome.externalRunRef!;

      const cancelOutcome = await adapter.cancel(
        runRef,
        "harness://cancel-intent/user-abort",
      );
      expect(cancelOutcome.cancellationState).toBe("requested");
      expect(cancelOutcome.status).toBe("waiting");
      expect(cancelOutcome.pendingAction).toMatch(/^ariadne:\/\/pending\/cancel-/);
      expect(cancelOutcome.pointers).toContain(
        "harness://cancel-intent/user-abort",
      );

      const ackOutcome = await adapter.acknowledgeCancellation(
        runRef,
        "ariadne://receipt/canceled-1",
      );
      expect(ackOutcome.cancellationState).toBe("acknowledged");
      expect(ackOutcome.status).toBe("canceled");
      expect(ackOutcome.pendingAction).toBeUndefined();
      expect(ackOutcome.pointers).toContain("ariadne://receipt/canceled-1");
    });

    it("emits monotonic events with idempotent equal-cursor replay and rejects gaps", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a05", {
        operation: "gate",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      const runRef = startOutcome.externalRunRef!;
      await adapter.wait(runRef, "ariadne://pending/gate-1", "ariadne://receipt/waiting-g1");
      await adapter.resume(runRef, "ariadne://answer/gate-1", "ariadne://receipt/resumed-g1");

      const allEvents = await adapter.events(runRef, 0);
      expect(allEvents).toHaveLength(3);
      expect(allEvents.map((e) => e.cursor)).toEqual([1, 2, 3]);

      const fromCursor2 = await adapter.events(runRef, 2);
      expect(fromCursor2).toHaveLength(2);
      expect(fromCursor2[0].cursor).toBe(2);

      // Cursor gap fails closed
      await expect(adapter.events(runRef, 99)).rejects.toThrow(/cursor gap/i);
    });
  });

  describe("3. Only Ariadne validates and applies graph mutations", () => {
    it("completes an ingest with Ariadne-owned receipt and graph revision pointer", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a06", {
        operation: "ingest",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
        inputRef: "file://matt/evidence.json@sha256:e1",
        evidenceReceiptRef: "matt://receipt/succeeded-1",
      });

      const runRef = startOutcome.externalRunRef!;
      const outcome = await adapter.complete(runRef, {
        receiptRef: "ariadne://receipt/ingest-1",
        graphRevisionRef: "ariadne://graph/rev-g2",
      });

      expect(outcome.status).toBe("succeeded");
      expect(outcome.step).toBe("graph mutation complete");
      expect(outcome.pointers).toContain("ariadne://receipt/ingest-1");
      expect(outcome.pointers).toContain("ariadne://graph/rev-g2");

      // Only ariadne:// scheme may carry graph revision pointers
      for (const ptr of outcome.pointers) {
        if (ptr.includes("graph/rev-")) {
          expect(ptr).toMatch(/^ariadne:\/\//);
        }
      }
    });

    it("fails closed before graph mutation when receipt is missing", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a07", {
        operation: "ingest",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
        inputRef: "file://matt/evidence.json@sha256:e1",
      });

      const runRef = startOutcome.externalRunRef!;
      const outcome = await adapter.complete(runRef, {
        receiptRef: "",
        graphRevisionRef: "ariadne://graph/rev-g2",
      });

      expect(outcome.status).toBe("failed");
      expect(outcome.error).toMatch(/missing or invalid.*receipt/i);
    });
  });

  describe("4. Fail-closed on invalid operations, pins, receipts, cursors, or owner bindings", () => {
    it("rejects shadow state injection (non-pointer raw data)", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a08", {
        operation: "preflight",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      const runRef = startOutcome.externalRunRef!;
      await expect(
        adapter.addPointer(runRef, "raw graph node payload without a scheme"),
      ).rejects.toThrow(/pointer scheme/i);
    });

    it("rejects non-ariadne-scheme receipts for Ariadne-owned operations", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a09", {
        operation: "gate",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      const runRef = startOutcome.externalRunRef!;
      await expect(
        adapter.complete(runRef, {
          receiptRef: "matt://receipt/wrong-owner",
          graphRevisionRef: "ariadne://graph/rev-g2",
        }),
      ).rejects.toThrow(/owner mismatch/i);
    });

    it("rejects automatic replay of an ambiguous effect", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-a10", {
        operation: "invalidation",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        graphRef: "ariadne://graph/rev-g1",
      });

      const runRef = startOutcome.externalRunRef!;
      await adapter.recordAmbiguousEffect(runRef, "owner://effect/ambiguous-1");

      const replayOutcome = await adapter.attemptAutoReplay(runRef);
      expect(replayOutcome.status).toBe("failed");
      expect(replayOutcome.effectState).toBe("duplicated");
      expect(replayOutcome.error).toMatch(/replay/i);
    });
  });

  describe("5. Direct Ariadne result import", () => {
    it("imports a directly executed Ariadne result via validated receipt and graph pointers", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const outcome = await adapter.importDirectResult({
        directReceiptRef: "ariadne://receipt/direct-1",
        graphRevisionRef: "ariadne://graph/rev-g1",
        adapterRef: "adapter://ariadne@sha256:ariadne1",
        workspaceRef: "workspace://repo@rev:w1",
        contractRef: "contract://method@sha256:m1",
      });

      expect(outcome.status).toBe("running");
      expect(outcome.step).toBe("ready for harness");
      expect(outcome.pointers).toContain("ariadne://receipt/direct-1");
      expect(outcome.pointers).toContain("ariadne://graph/rev-g1");
      expect(outcome.pointers).toContain("adapter://ariadne@sha256:ariadne1");
      expect(outcome.pointers).toContain("workspace://repo@rev:w1");
      expect(outcome.pointers).toContain("contract://method@sha256:m1");
    });

    it("rejects direct import with missing or invalid receipt", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      await expect(
        adapter.importDirectResult({
          directReceiptRef: "",
          graphRevisionRef: "ariadne://graph/rev-g1",
          adapterRef: "adapter://ariadne@sha256:ariadne1",
          workspaceRef: "workspace://repo@rev:w1",
          contractRef: "contract://method@sha256:m1",
        }),
      ).rejects.toThrow(/invalid.*receipt/i);
    });
  });

  describe("6. Owner-neutral integration stays separate from Ariadne's controller", () => {
    it("adapter does not expose or modify any Ariadne graph store or controller state", () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      expect((adapter as any).graphStore).toBeUndefined();
      expect((adapter as any).epistemicOverlay).toBeUndefined();
      expect((adapter as any).controller).toBeUndefined();
    });

    it("allows direct Ariadne use to remain valid without interception", async () => {
      const adapter = new AriadneOwnerAdapter({ version: "1.0.0" });
      const outcome = await adapter.importDirectResult({
        directReceiptRef: "ariadne://receipt/standalone-1",
        graphRevisionRef: "ariadne://graph/rev-g-standalone",
        workspaceRef: "workspace://repo@rev:w1",
        contractRef: "contract://method@sha256:m1",
      });

      expect(outcome.status).toBe("running");
      expect(outcome.step).toBe("ready for harness");
      // Direct use does not depend on any tracked run
      expect((adapter as any).runs.size).toBe(0);
    });
  });
});
