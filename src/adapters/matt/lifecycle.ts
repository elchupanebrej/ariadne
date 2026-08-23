import { createHash } from "node:crypto";
import { MATT_SKILLS, type MattSkill } from "./ingest.js";
import {
  type AdapterCapabilities,
  type CancellationState,
  type EffectState,
  type LifecycleEvent,
  type LifecycleOutcome,
  type LifecycleStatus,
  type OwnerAdapter,
  assertValidPointer,
  isValidPointer,
} from "../lifecycle.js";

export interface MattAdapterOptions {
  version?: string;
  adapterId?: string;
}

export interface MattStartRequest {
  skill: MattSkill;
  contractRef: string;
  workspaceRef: string;
  interactionMode: "headless" | "interactive" | "hitl";
  requiredArtifactKinds: string[];
  contextPointers?: string[];
  idempotencyKey?: string;
}

export interface MattCompletePayload {
  artifactRef: string;
  receiptRef: string;
  status?: "succeeded" | "failed";
}

export interface MattReceipt {
  receiptRef: string;
  runRef: string;
  timestamp: string;
  kind?: string;
}

export interface DirectMattImportRequest {
  directReceiptRef: string;
  artifactRef: string;
  adapterRef?: string;
  workspaceRef: string;
  contractRef: string;
}

interface RunRecord {
  runRef: string;
  requestRef: string;
  skill: MattSkill;
  status: LifecycleStatus;
  effectState: EffectState;
  cancellationState: CancellationState;
  eventCursor: number;
  step?: string;
  pendingAction?: string;
  pointers: string[];
  events: LifecycleEvent[];
  error?: string;
}

export class MattOwnerAdapter implements OwnerAdapter<MattStartRequest, MattCompletePayload> {
  readonly version: string;
  readonly adapterId: string;
  private runs = new Map<string, RunRecord>();
  private runCounter = 0;

  constructor(options: MattAdapterOptions = {}) {
    this.version = options.version ?? "1.0.0";
    this.adapterId = options.adapterId ?? "adapter://matt";
  }

  capabilities(): AdapterCapabilities {
    return {
      adapterId: this.adapterId,
      adapterVersion: this.version,
      owner: "matt",
      supportedOperations: ["start", "resume", "cancel", "events", "direct_import"],
      supportedSkills: MATT_SKILLS,
      supportedInteractionModes: ["headless", "interactive", "hitl"],
      supportedArtifactKinds: ["EVD", "EVDREQ", "markdown", "json"],
      minHostVersion: "1.0.0",
    };
  }

  async start(
    requestRef: string,
    requestPayload?: MattStartRequest,
  ): Promise<LifecycleOutcome> {
    if (!requestPayload) {
      return {
        status: "failed",
        effectState: "none",
        cancellationState: "none",
        eventCursor: 0,
        pointers: [],
        error: "Missing start request payload",
      };
    }

    const { skill, contractRef, workspaceRef, interactionMode, requiredArtifactKinds, contextPointers } =
      requestPayload;

    if (!MATT_SKILLS.includes(skill)) {
      const diagDigest = createHash("sha256").update(String(skill)).digest("hex").slice(0, 8);
      const diagnosticRef = `adapter://diagnostic/unsupported-${diagDigest}`;
      return {
        status: "failed",
        effectState: "none",
        cancellationState: "none",
        eventCursor: 0,
        diagnosticRef,
        pointers: [diagnosticRef],
        error: `Unsupported skill: ${skill}`,
      };
    }

    // Validate pointers
    if (contractRef) assertValidPointer(contractRef, "contractRef");
    if (workspaceRef) assertValidPointer(workspaceRef, "workspaceRef");
    if (contextPointers) {
      for (const ptr of contextPointers) {
        assertValidPointer(ptr, "contextPointer");
      }
    }

    this.runCounter += 1;
    const runRef = `host://run/matt-${Date.now()}-${this.runCounter}`;
    const adapterRef = `${this.adapterId}@sha256:${this.version}`;

    const pointers: string[] = [adapterRef];
    if (contractRef) pointers.push(contractRef);
    if (workspaceRef) pointers.push(workspaceRef);
    if (contextPointers) pointers.push(...contextPointers);
    pointers.push(runRef);

    const initialEvent: LifecycleEvent = {
      cursor: 1,
      timestamp: new Date().toISOString(),
      runRef,
      kind: "status_changed",
      previousStatus: "created",
      newStatus: "running",
      pointer: runRef,
    };

    const record: RunRecord = {
      runRef,
      requestRef,
      skill,
      status: "running",
      effectState: "none",
      cancellationState: "none",
      eventCursor: 1,
      step: "Matt skill",
      pointers,
      events: [initialEvent],
    };

    this.runs.set(runRef, record);

    return this.outcomeFor(record);
  }

  async wait(
    runRef: string,
    pendingActionRef: string,
    receiptRef?: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(runRef);
    if (record.status !== "running") {
      throw new Error(`Cannot wait run in status ${record.status}`);
    }
    assertValidPointer(pendingActionRef, "pendingActionRef");
    if (receiptRef) assertValidPointer(receiptRef, "receiptRef");

    record.status = "waiting";
    record.pendingAction = pendingActionRef;
    if (receiptRef && !record.pointers.includes(receiptRef)) {
      record.pointers.push(receiptRef);
    }
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef,
      kind: "pending_action_set",
      pointer: pendingActionRef,
    });

    return this.outcomeFor(record);
  }

  async resume(
    externalRunRef: string,
    inputRef: string,
    receiptRef?: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    if (record.status !== "waiting") {
      throw new Error(`Cannot resume run in status ${record.status}`);
    }
    assertValidPointer(inputRef, "inputRef");
    if (receiptRef) assertValidPointer(receiptRef, "receiptRef");

    record.status = "running";
    record.pendingAction = undefined;
    if (!record.pointers.includes(inputRef)) {
      record.pointers.push(inputRef);
    }
    if (receiptRef && !record.pointers.includes(receiptRef)) {
      record.pointers.push(receiptRef);
    }
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "pending_action_resolved",
      pointer: inputRef,
    });

    return this.outcomeFor(record);
  }

  async complete(
    externalRunRef: string,
    payload: MattCompletePayload,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    const { artifactRef, receiptRef, status = "succeeded" } = payload;

    if (!receiptRef || !isValidPointer(receiptRef)) {
      record.status = "failed";
      record.error = "Ariadne rejected a missing or invalid Matt evidence receipt";
      return this.outcomeFor(record);
    }

    assertValidPointer(artifactRef, "artifactRef");
    if (!record.pointers.includes(receiptRef)) record.pointers.push(receiptRef);
    if (!record.pointers.includes(artifactRef)) record.pointers.push(artifactRef);

    record.status = status;
    record.step = "ready for Ariadne";
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "receipt_emitted",
      pointer: receiptRef,
    });

    return this.outcomeFor(record);
  }

  async cancel(
    externalRunRef: string,
    reasonRef: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    assertValidPointer(reasonRef, "reasonRef");

    record.cancellationState = "requested";
    record.status = "waiting";
    record.pendingAction = `host://pending/cancel-${Date.now()}`;
    if (!record.pointers.includes(reasonRef)) record.pointers.push(reasonRef);
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "cancellation_requested",
      pointer: reasonRef,
    });

    return this.outcomeFor(record);
  }

  async acknowledgeCancellation(
    externalRunRef: string,
    cancelReceiptRef: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    if (record.cancellationState !== "requested") {
      throw new Error(`No cancellation requested for run ${externalRunRef}`);
    }
    if (record.effectState === "ambiguous") {
      throw new Error("Owner inspection is required before terminal cancellation");
    }
    assertValidPointer(cancelReceiptRef, "cancelReceiptRef");

    record.cancellationState = "acknowledged";
    record.status = "canceled";
    record.pendingAction = undefined;
    if (!record.pointers.includes(cancelReceiptRef)) {
      record.pointers.push(cancelReceiptRef);
    }
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "cancellation_acknowledged",
      pointer: cancelReceiptRef,
    });

    return this.outcomeFor(record);
  }

  async recordAmbiguousEffect(
    externalRunRef: string,
    effectRef: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    assertValidPointer(effectRef, "effectRef");

    record.effectState = "ambiguous";
    record.status = "waiting";
    record.pendingAction = `owner://pending/inspect-effect-${Date.now()}`;
    if (!record.pointers.includes(effectRef)) record.pointers.push(effectRef);
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "effect_recorded",
      pointer: effectRef,
    });

    return this.outcomeFor(record);
  }

  async attachEffectInspectionReceipt(
    externalRunRef: string,
    inspectionReceiptRef: string,
    committed: boolean,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    if (record.effectState !== "ambiguous") {
      throw new Error(`No ambiguous effect to inspect for run ${externalRunRef}`);
    }
    assertValidPointer(inspectionReceiptRef, "inspectionReceiptRef");

    record.effectState = committed ? "committed" : "no_effect";
    record.pendingAction =
      record.cancellationState === "requested" ? `host://pending/cancel-${Date.now()}` : undefined;
    record.status = record.cancellationState === "requested" ? "waiting" : "running";
    if (!record.pointers.includes(inspectionReceiptRef)) {
      record.pointers.push(inspectionReceiptRef);
    }
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef: externalRunRef,
      kind: "receipt_emitted",
      pointer: inspectionReceiptRef,
    });

    return this.outcomeFor(record);
  }

  async attemptAutoReplay(externalRunRef: string): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    record.effectState = "duplicated";
    record.status = "failed";
    record.pendingAction = undefined;
    record.error = "an ambiguous effect was automatically replayed without owner replay declaration";
    return this.outcomeFor(record);
  }

  async events(
    externalRunRef: string,
    fromCursor = 0,
  ): Promise<LifecycleEvent[]> {
    const record = this.requireRun(externalRunRef);
    if (fromCursor > record.eventCursor) {
      throw new Error(
        `Cursor gap: requested cursor ${fromCursor} exceeds current cursor ${record.eventCursor}`,
      );
    }
    return record.events.filter((event) => event.cursor >= fromCursor);
  }

  async addPointer(externalRunRef: string, pointer: string): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    assertValidPointer(pointer, "pointer");
    if (!record.pointers.includes(pointer)) {
      record.pointers.push(pointer);
    }
    return this.outcomeFor(record);
  }

  async importDirectResult(
    request: DirectMattImportRequest,
  ): Promise<LifecycleOutcome> {
    const { directReceiptRef, artifactRef, adapterRef, workspaceRef, contractRef } = request;
    if (!directReceiptRef || !isValidPointer(directReceiptRef)) {
      throw new Error("Missing or invalid direct receipt pointer");
    }
    assertValidPointer(artifactRef, "artifactRef");
    if (adapterRef) assertValidPointer(adapterRef, "adapterRef");
    if (workspaceRef) assertValidPointer(workspaceRef, "workspaceRef");
    if (contractRef) assertValidPointer(contractRef, "contractRef");

    const pointers: string[] = [directReceiptRef, artifactRef];
    if (adapterRef) pointers.push(adapterRef);
    if (workspaceRef) pointers.push(workspaceRef);
    if (contractRef) pointers.push(contractRef);

    return {
      status: "running",
      step: "ready for Ariadne",
      effectState: "none",
      cancellationState: "none",
      eventCursor: 1,
      pointers,
      receiptRef: directReceiptRef,
      artifactRef,
    };
  }

  private requireRun(runRef: string): RunRecord {
    const run = this.runs.get(runRef);
    if (!run) {
      throw new Error(`Run not found: ${runRef}`);
    }
    return run;
  }

  private outcomeFor(record: RunRecord): LifecycleOutcome {
    return {
      status: record.status,
      externalRunRef: record.runRef,
      effectState: record.effectState,
      cancellationState: record.cancellationState,
      eventCursor: record.eventCursor,
      step: record.step,
      pendingAction: record.pendingAction,
      pointers: [...record.pointers],
      error: record.error,
    };
  }
}
