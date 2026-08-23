import { createHash } from "node:crypto";
import {
  type AdapterCapabilities,
  type CancellationState,
  type EffectState,
  type LifecycleEvent,
  type LifecycleOutcome,
  type LifecycleStatus,
  type OwnerAdapter,
  assertOwnerScheme,
  assertValidPointer,
  isValidPointer,
  sha256Digest,
} from "../lifecycle.js";

export type AriadneOperation =
  | "preflight"
  | "graph"
  | "ingest"
  | "gate"
  | "invalidation"
  | "handoff";

export const ARIADNE_OPERATIONS: readonly AriadneOperation[] = [
  "preflight",
  "graph",
  "ingest",
  "gate",
  "invalidation",
  "handoff",
];

export interface AriadneAdapterOptions {
  version?: string;
  adapterId?: string;
  adapterDigest?: string;
}

export interface AriadneStartRequest {
  operation: AriadneOperation;
  contractRef: string;
  workspaceRef: string;
  graphRef: string;
  inputRef?: string;
  evidenceReceiptRef?: string;
  contextPointers?: string[];
  authorityRef?: string;
  deadline?: string;
}

export interface AriadneCompletePayload {
  receiptRef: string;
  graphRevisionRef?: string;
  artifactRef?: string;
  status?: "succeeded" | "failed";
}

export interface DirectAriadneImportRequest {
  directReceiptRef: string;
  graphRevisionRef: string;
  adapterRef?: string;
  workspaceRef: string;
  contractRef: string;
}

interface RunRecord {
  runRef: string;
  requestRef: string;
  operation: AriadneOperation;
  status: LifecycleStatus;
  effectState: EffectState;
  cancellationState: CancellationState;
  eventCursor: number;
  step?: string;
  pendingAction?: string;
  pointers: string[];
  events: LifecycleEvent[];
  authorityRef?: string;
  resumePredicate?: string;
  deadline?: string;
  reason?: string;
  error?: string;
}

export class AriadneOwnerAdapter
  implements OwnerAdapter<AriadneStartRequest, AriadneCompletePayload>
{
  readonly version: string;
  readonly adapterId: string;
  readonly adapterDigest: string;
  private runs = new Map<string, RunRecord>();
  private runCounter = 0;

  constructor(options: AriadneAdapterOptions = {}) {
    this.version = options.version ?? "1.0.0";
    this.adapterId = options.adapterId ?? "adapter://ariadne";
    this.adapterDigest =
      options.adapterDigest ??
      sha256Digest(`ariadne-adapter-${this.version}`).slice(0, 16);
  }

  capabilities(): AdapterCapabilities {
    return {
      adapterId: this.adapterId,
      adapterVersion: this.version,
      owner: "ariadne",
      supportedOperations: [
        "start",
        "resume",
        "cancel",
        "events",
        "direct_import",
        ...ARIADNE_OPERATIONS,
      ],
      supportedInteractionModes: ["headless"],
      supportedArtifactKinds: ["EVD", "EVDREQ", "graph_revision", "markdown"],
      minHostVersion: "1.0.0",
    };
  }

  async start(
    requestRef: string,
    requestPayload?: AriadneStartRequest,
  ): Promise<LifecycleOutcome> {
    assertValidPointer(requestRef, "requestRef");

    if (!requestPayload) {
      return {
        status: "failed",
        effectState: "none",
        cancellationState: "none",
        eventCursor: 0,
        pointers: [requestRef],
        error: "Missing start request payload",
        reason: "missing_request_payload",
      };
    }

    const {
      operation,
      contractRef,
      workspaceRef,
      graphRef,
      inputRef,
      evidenceReceiptRef,
      contextPointers,
      authorityRef,
      deadline,
    } = requestPayload;

    if (!ARIADNE_OPERATIONS.includes(operation)) {
      const diagDigest = createHash("sha256")
        .update(String(operation))
        .digest("hex")
        .slice(0, 8);
      const diagnosticRef = `adapter://diagnostic/unsupported-${diagDigest}`;
      return {
        status: "failed",
        effectState: "none",
        cancellationState: "none",
        eventCursor: 0,
        diagnosticRef,
        pointers: [diagnosticRef],
        error: `Unsupported Ariadne operation: ${operation}`,
        reason: "unsupported_operation",
      };
    }

    // Validate pointers
    if (contractRef) assertOwnerScheme(contractRef, "contract", "contractRef");
    if (workspaceRef) assertOwnerScheme(workspaceRef, "workspace", "workspaceRef");
    if (graphRef) assertOwnerScheme(graphRef, "ariadne", "graphRef");
    if (inputRef) assertValidPointer(inputRef, "inputRef");
    if (evidenceReceiptRef)
      assertOwnerScheme(evidenceReceiptRef, ["matt", "ariadne", "host", "owner"], "evidenceReceiptRef");
    if (authorityRef) assertValidPointer(authorityRef, "authorityRef");
    if (contextPointers) {
      for (const ptr of contextPointers) {
        assertValidPointer(ptr, "contextPointer");
      }
    }

    this.runCounter += 1;
    const runRef = `ariadne://run/${operation}-${Date.now()}-${this.runCounter}`;
    const adapterRef = `${this.adapterId}@sha256:${this.adapterDigest}`;

    const pointers: string[] = [adapterRef];
    if (contractRef) pointers.push(contractRef);
    if (workspaceRef) pointers.push(workspaceRef);
    if (graphRef) pointers.push(graphRef);
    if (inputRef) pointers.push(inputRef);
    if (evidenceReceiptRef) pointers.push(evidenceReceiptRef);
    if (authorityRef) pointers.push(authorityRef);
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
      operation,
      status: "running",
      effectState: "none",
      cancellationState: "none",
      eventCursor: 1,
      step: `Ariadne ${operation}`,
      pointers,
      events: [initialEvent],
      authorityRef,
      deadline,
    };

    this.runs.set(runRef, record);
    return this.outcomeFor(record);
  }

  async wait(
    runRef: string,
    pendingActionRef: string,
    receiptRef?: string,
    options: {
      authorityRef?: string;
      resumePredicate?: string;
      deadline?: string;
      reason?: string;
    } = {},
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(runRef);
    if (record.status !== "running") {
      throw new Error(`Cannot wait run in status ${record.status}`);
    }
    assertOwnerScheme(pendingActionRef, ["ariadne", "host", "owner"], "pendingActionRef");
    if (receiptRef) assertOwnerScheme(receiptRef, ["ariadne", "host", "owner"], "receiptRef");
    if (options.authorityRef) assertValidPointer(options.authorityRef, "authorityRef");

    record.status = "waiting";
    record.pendingAction = pendingActionRef;
    if (options.authorityRef) record.authorityRef = options.authorityRef;
    if (options.resumePredicate) record.resumePredicate = options.resumePredicate;
    if (options.deadline) record.deadline = options.deadline;
    if (options.reason) record.reason = options.reason;

    if (receiptRef) this.addUnique(record.pointers, receiptRef);
    record.eventCursor += 1;

    record.events.push({
      cursor: record.eventCursor,
      timestamp: new Date().toISOString(),
      runRef,
      kind: "pending_action_set",
      pointer: pendingActionRef,
      reason: options.reason,
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
    assertOwnerScheme(
      inputRef,
      ["ariadne", "human", "host", "file", "owner"],
      "inputRef",
    );
    if (receiptRef)
      assertOwnerScheme(receiptRef, ["ariadne", "host", "owner"], "receiptRef");

    record.status = "running";
    record.pendingAction = undefined;
    record.resumePredicate = undefined;
    this.addUnique(record.pointers, inputRef);
    if (receiptRef) this.addUnique(record.pointers, receiptRef);
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
    payload: AriadneCompletePayload,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    const { receiptRef, graphRevisionRef, artifactRef, status = "succeeded" } = payload;

    if (!receiptRef || !isValidPointer(receiptRef)) {
      record.status = "failed";
      record.error = "Ariadne rejected a missing or invalid receipt";
      record.reason = "invalid_receipt";
      return this.outcomeFor(record);
    }

    // Ariadne receipts must carry the ariadne:// scheme — owner mismatch fails closed
    assertOwnerScheme(receiptRef, "ariadne", "receiptRef");

    if (graphRevisionRef) {
      assertOwnerScheme(graphRevisionRef, "ariadne", "graphRevisionRef");
      this.addUnique(record.pointers, graphRevisionRef);
    }
    if (artifactRef) {
      assertValidPointer(artifactRef, "artifactRef");
      this.addUnique(record.pointers, artifactRef);
    }
    this.addUnique(record.pointers, receiptRef);

    record.status = status;
    record.step = "graph mutation complete";
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
    assertOwnerScheme(reasonRef, ["harness", "host", "owner"], "reasonRef");

    record.cancellationState = "requested";
    record.status = "waiting";
    record.pendingAction = `ariadne://pending/cancel-${Date.now()}`;
    record.reason = "cancellation_requested";
    this.addUnique(record.pointers, reasonRef);
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
    assertOwnerScheme(cancelReceiptRef, ["ariadne", "host", "owner"], "cancelReceiptRef");

    record.cancellationState = "acknowledged";
    record.status = "canceled";
    record.pendingAction = undefined;
    record.reason = "canceled";
    this.addUnique(record.pointers, cancelReceiptRef);
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
    assertOwnerScheme(effectRef, "owner", "effectRef");

    record.effectState = "ambiguous";
    record.status = "waiting";
    record.pendingAction = `owner://pending/inspect-effect-${Date.now()}`;
    record.reason = "ambiguous_effect";
    this.addUnique(record.pointers, effectRef);
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
    assertOwnerScheme(
      inspectionReceiptRef,
      ["owner", "ariadne", "host"],
      "inspectionReceiptRef",
    );

    record.effectState = committed ? "committed" : "no_effect";
    record.pendingAction =
      record.cancellationState === "requested"
        ? `ariadne://pending/cancel-${Date.now()}`
        : undefined;
    record.status =
      record.cancellationState === "requested" ? "waiting" : "running";
    record.reason = undefined;
    this.addUnique(record.pointers, inspectionReceiptRef);
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
    record.error =
      "an ambiguous effect was automatically replayed without owner replay declaration";
    record.reason = "unauthorized_replay";
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

  async addPointer(
    externalRunRef: string,
    pointer: string,
  ): Promise<LifecycleOutcome> {
    const record = this.requireRun(externalRunRef);
    assertValidPointer(pointer, "pointer");
    this.addUnique(record.pointers, pointer);
    return this.outcomeFor(record);
  }

  async importDirectResult(
    request: DirectAriadneImportRequest,
  ): Promise<LifecycleOutcome> {
    const { directReceiptRef, graphRevisionRef, adapterRef, workspaceRef, contractRef } =
      request;

    if (!directReceiptRef || !isValidPointer(directReceiptRef)) {
      throw new Error("Missing or invalid direct receipt pointer");
    }
    assertOwnerScheme(directReceiptRef, ["ariadne", "host", "owner"], "directReceiptRef");
    assertOwnerScheme(graphRevisionRef, "ariadne", "graphRevisionRef");
    if (adapterRef) assertOwnerScheme(adapterRef, "adapter", "adapterRef");
    if (workspaceRef) assertOwnerScheme(workspaceRef, "workspace", "workspaceRef");
    if (contractRef) assertOwnerScheme(contractRef, "contract", "contractRef");

    const pointers: string[] = [directReceiptRef, graphRevisionRef];
    if (adapterRef) pointers.push(adapterRef);
    if (workspaceRef) pointers.push(workspaceRef);
    if (contractRef) pointers.push(contractRef);

    return {
      status: "running",
      step: "ready for harness",
      effectState: "none",
      cancellationState: "none",
      eventCursor: 1,
      pointers,
      receiptRef: directReceiptRef,
    };
  }

  private requireRun(runRef: string): RunRecord {
    const run = this.runs.get(runRef);
    if (!run) {
      throw new Error(`Run not found: ${runRef}`);
    }
    return run;
  }

  private addUnique(list: string[], ptr: string): void {
    if (!list.includes(ptr)) list.push(ptr);
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
      authorityRef: record.authorityRef,
      resumePredicate: record.resumePredicate,
      deadline: record.deadline,
      reason: record.reason,
      error: record.error,
    };
  }
}
