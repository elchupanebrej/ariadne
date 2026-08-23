import { describe, expect, it } from "vitest";
import {
  MattOwnerAdapter,
  type MattStartRequest,
  type MattReceipt,
} from "../../src/adapters/matt/lifecycle.js";
import type { LifecycleOutcome } from "../../src/adapters/lifecycle.js";

describe("09 — Matt owner lifecycle contract", () => {
  describe("1. Capability negotiation", () => {
    it("declares supported skills, lifecycle operations, versions, and required artifact kinds", () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const capabilities = adapter.capabilities();

      expect(capabilities.adapterId).toBe("adapter://matt");
      expect(capabilities.adapterVersion).toBe("1.0.0");
      expect(capabilities.owner).toBe("matt");
      expect(capabilities.supportedOperations).toContain("start");
      expect(capabilities.supportedOperations).toContain("resume");
      expect(capabilities.supportedOperations).toContain("cancel");
      expect(capabilities.supportedOperations).toContain("events");
      expect(capabilities.supportedOperations).toContain("direct_import");

      expect(capabilities.supportedSkills).toContain("diagnosing-bugs");
      expect(capabilities.supportedSkills).toContain("research");
      expect(capabilities.supportedSkills).toContain("prototype");
      expect(capabilities.supportedSkills).toContain("tdd");
      expect(capabilities.supportedSkills).toContain("domain-modeling");
      expect(capabilities.supportedSkills).toContain("codebase-design");
      expect(capabilities.supportedSkills).toContain("code-review");

      expect(capabilities.supportedInteractionModes).toEqual(
        expect.arrayContaining(["headless", "interactive", "hitl"]),
      );
      expect(capabilities.supportedArtifactKinds).toEqual(
        expect.arrayContaining(["EVD", "EVDREQ", "markdown", "json"]),
      );
    });

    it("rejects dispatch for an unsupported skill or invalid version before execution", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const invalidRequest: MattStartRequest = {
        skill: "unsupported-magic-skill" as any,
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["EVD"],
      };

      const outcome = await adapter.start("harness://request/req-001", invalidRequest);
      expect(outcome.status).toBe("failed");
      expect(outcome.error).toMatch(/unsupported skill/i);
      expect(outcome.diagnosticRef).toMatch(/^adapter:\/\/diagnostic\/unsupported-/);
      expect(outcome.pointers).toContainEqual(outcome.diagnosticRef);
    });
  });

  describe("2. Start with pinned skill and pointer-only references", () => {
    it("accepts a pinned skill and returns external run reference rather than copied owner state", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const request: MattStartRequest = {
        skill: "diagnosing-bugs",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "hitl",
        requiredArtifactKinds: ["EVDREQ"],
        contextPointers: ["file://.scratch/substrate.md@sha256:s1"],
      };

      const outcome = await adapter.start("harness://request/req-002", request);
      expect(outcome.status).toBe("running");
      expect(outcome.externalRunRef).toMatch(/^host:\/\/run\/matt-/);
      expect(outcome.eventCursor).toBe(1);
      expect(outcome.pointers.some((p) => p.startsWith("adapter://matt@sha256:"))).toBe(true);
      expect(outcome.pointers).toContain("contract://method@sha256:m1");
      expect(outcome.pointers).toContain("workspace://repo@rev:w1");
      expect(outcome.pointers).toContain("file://.scratch/substrate.md@sha256:s1");
      expect(outcome.pointers).toContain(outcome.externalRunRef!);

      // Assert no raw semantic payload is stored in pointers
      for (const ptr of outcome.pointers) {
        expect(ptr).toMatch(/^[a-z0-9_-]+:\/\/.+/i);
      }
    });
  });

  describe("3. Resume and monotonic event cursors with idempotent equal-cursor handling", () => {
    it("transitions to waiting on human prompt and resumes with external run and input references", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-003", {
        skill: "tdd",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "hitl",
        requiredArtifactKinds: ["EVD"],
      });

      const runRef = startOutcome.externalRunRef!;

      // Signal waiting for human
      const waitOutcome = await adapter.wait(runRef, "host://pending/human-1", "matt://receipt/waiting-1");
      expect(waitOutcome.status).toBe("waiting");
      expect(waitOutcome.pendingAction).toBe("host://pending/human-1");
      expect(waitOutcome.pointers).toContain("matt://receipt/waiting-1");
      expect(waitOutcome.eventCursor).toBe(2);

      // Resume with human input reference
      const resumeOutcome = await adapter.resume(runRef, "human://answer/1", "matt://receipt/resumed-1");
      expect(resumeOutcome.status).toBe("running");
      expect(resumeOutcome.pendingAction).toBeUndefined();
      expect(resumeOutcome.pointers).toContain("human://answer/1");
      expect(resumeOutcome.pointers).toContain("matt://receipt/resumed-1");
      expect(resumeOutcome.eventCursor).toBe(3);
    });

    it("maintains monotonic event cursors and provides idempotent equal-cursor handling", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-004", {
        skill: "research",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["markdown"],
      });

      const runRef = startOutcome.externalRunRef!;
      await adapter.wait(runRef, "host://pending/approval-1", "matt://receipt/waiting-approval");
      await adapter.resume(runRef, "host://approval/1", "matt://receipt/resumed-approval");

      const allEvents = await adapter.events(runRef, 0);
      expect(allEvents).toHaveLength(3);
      expect(allEvents.map((e) => e.cursor)).toEqual([1, 2, 3]);

      // Equal-cursor query is idempotent and returns events from that cursor
      const fromCursor2 = await adapter.events(runRef, 2);
      expect(fromCursor2).toHaveLength(2);
      expect(fromCursor2[0].cursor).toBe(2);
      expect(fromCursor2[1].cursor).toBe(3);

      // Querying again with cursor 2 returns identical result
      const fromCursor2Again = await adapter.events(runRef, 2);
      expect(fromCursor2Again).toEqual(fromCursor2);

      // Cursor gap / future cursor fails closed
      await expect(adapter.events(runRef, 99)).rejects.toThrow(/cursor gap/i);
    });
  });

  describe("4. Cancellation handshake", () => {
    it("keeps cancellation as intent until terminal owner acknowledgment receipt", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-005", {
        skill: "code-review",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["markdown"],
      });

      const runRef = startOutcome.externalRunRef!;

      // Request cancellation
      const cancelOutcome = await adapter.cancel(runRef, "harness://cancel-intent/user-abort");
      expect(cancelOutcome.cancellationState).toBe("requested");
      expect(cancelOutcome.status).toBe("waiting");
      expect(cancelOutcome.pendingAction).toMatch(/^host:\/\/pending\/cancel-/);
      expect(cancelOutcome.pointers).toContain("harness://cancel-intent/user-abort");

      // Host acknowledges cancellation
      const ackOutcome = await adapter.acknowledgeCancellation(
        runRef,
        "host://receipt/canceled-1",
      );
      expect(ackOutcome.cancellationState).toBe("acknowledged");
      expect(ackOutcome.status).toBe("canceled");
      expect(ackOutcome.pendingAction).toBeUndefined();
      expect(ackOutcome.pointers).toContain("host://receipt/canceled-1");
    });

    it("prevents cancellation acknowledgment when an ambiguous effect is unresolved", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-006", {
        skill: "prototype",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["markdown"],
      });

      const runRef = startOutcome.externalRunRef!;
      await adapter.recordAmbiguousEffect(runRef, "owner://effect/ambiguous-1");
      await adapter.cancel(runRef, "harness://cancel-intent/stop");

      // Attempting to acknowledge cancellation while ambiguous effect is pending fails
      await expect(
        adapter.acknowledgeCancellation(runRef, "host://receipt/canceled-1"),
      ).rejects.toThrow(/inspection is required before terminal cancellation/i);

      // Inspect and resolve effect
      await adapter.attachEffectInspectionReceipt(runRef, "owner://receipt/effect-committed-1", true);

      // Now cancellation can be acknowledged
      const finalAck = await adapter.acknowledgeCancellation(runRef, "host://receipt/canceled-1");
      expect(finalAck.status).toBe("canceled");
    });
  });

  describe("5. Fail-closed behavior on invalid receipts, cursor conflicts, and shadow state", () => {
    it("fails closed when artifact pointer is provided without a valid owner receipt", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-007", {
        skill: "tdd",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["EVD"],
      });

      const runRef = startOutcome.externalRunRef!;

      const completeOutcome = await adapter.complete(runRef, {
        artifactRef: "file://matt/evidence.json@sha256:bad",
        receiptRef: "", // missing receipt
      });

      expect(completeOutcome.status).toBe("failed");
      expect(completeOutcome.error).toMatch(/missing or invalid.*receipt/i);
    });

    it("rejects automatic replay of an ambiguous effect", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-008", {
        skill: "diagnosing-bugs",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["EVDREQ"],
      });

      const runRef = startOutcome.externalRunRef!;
      await adapter.recordAmbiguousEffect(runRef, "owner://effect/ambiguous-1");

      const replayOutcome = await adapter.attemptAutoReplay(runRef);
      expect(replayOutcome.status).toBe("failed");
      expect(replayOutcome.effectState).toBe("duplicated");
      expect(replayOutcome.error).toMatch(/replay/i);
    });

    it("rejects attempts to inject raw non-pointer shadow state", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const startOutcome = await adapter.start("harness://request/req-009", {
        skill: "research",
        contractRef: "contract://method@sha256:m1",
        workspaceRef: "workspace://repo@rev:w1",
        interactionMode: "headless",
        requiredArtifactKinds: ["markdown"],
      });

      const runRef = startOutcome.externalRunRef!;
      await expect(
        adapter.addPointer(runRef, "This is raw markdown ticket content not a pointer"),
      ).rejects.toThrow(/pointer scheme/i);
    });
  });

  describe("6. Direct Matt use import", () => {
    it("imports a directly executed Matt skill result via validated receipt and artifact pointers", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      const outcome = await adapter.importDirectResult({
        directReceiptRef: "matt://receipt/direct-1",
        artifactRef: "file://matt/direct-evidence.json@sha256:d1",
        adapterRef: "adapter://matt@sha256:matt1",
        workspaceRef: "workspace://repo@rev:w1",
        contractRef: "contract://method@sha256:m1",
      });

      expect(outcome.status).toBe("running");
      expect(outcome.step).toBe("ready for Ariadne");
      expect(outcome.pointers).toContain("matt://receipt/direct-1");
      expect(outcome.pointers).toContain("file://matt/direct-evidence.json@sha256:d1");
      expect(outcome.pointers).toContain("adapter://matt@sha256:matt1");
      expect(outcome.pointers).toContain("workspace://repo@rev:w1");
      expect(outcome.pointers).toContain("contract://method@sha256:m1");
    });

    it("rejects direct result import with missing or invalid pointers", async () => {
      const adapter = new MattOwnerAdapter({ version: "1.0.0" });
      await expect(
        adapter.importDirectResult({
          directReceiptRef: "",
          artifactRef: "file://matt/direct-evidence.json@sha256:d1",
          adapterRef: "adapter://matt@sha256:matt1",
          workspaceRef: "workspace://repo@rev:w1",
          contractRef: "contract://method@sha256:m1",
        }),
      ).rejects.toThrow(/invalid.*receipt/i);
    });
  });
});
