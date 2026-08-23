export type LifecycleStatus =
  | "created"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "canceled";

export type EffectState =
  | "none"
  | "ambiguous"
  | "committed"
  | "no_effect"
  | "duplicated";

export type CancellationState =
  | "none"
  | "requested"
  | "acknowledged";

export interface LifecycleOutcome {
  status: LifecycleStatus;
  externalRunRef?: string;
  effectState: EffectState;
  cancellationState: CancellationState;
  eventCursor: number;
  step?: string;
  pendingAction?: string;
  pointers: string[];
  receiptRef?: string;
  artifactRef?: string;
  diagnosticRef?: string;
  error?: string;
}

export type LifecycleEventKind =
  | "status_changed"
  | "pending_action_set"
  | "pending_action_resolved"
  | "effect_recorded"
  | "cancellation_requested"
  | "cancellation_acknowledged"
  | "receipt_emitted"
  | "artifact_emitted"
  | "error_emitted";

export interface LifecycleEvent {
  cursor: number;
  timestamp: string;
  runRef: string;
  kind: LifecycleEventKind;
  previousStatus?: LifecycleStatus;
  newStatus?: LifecycleStatus;
  pointer?: string;
  digest?: string;
  reason?: string;
}

export interface AdapterCapabilities {
  adapterId: string;
  adapterVersion: string;
  owner: "matt" | "ariadne" | "host";
  supportedOperations: readonly string[];
  supportedSkills?: readonly string[];
  supportedInteractionModes: readonly ("headless" | "interactive" | "hitl")[];
  supportedArtifactKinds: readonly string[];
  minHostVersion?: string;
}

export interface OwnerAdapter<TStartRequest = unknown, TReceipt = unknown> {
  capabilities(): AdapterCapabilities;
  start(requestRef: string, requestPayload?: TStartRequest): Promise<LifecycleOutcome>;
  resume(externalRunRef: string, inputRef: string, inputPayload?: unknown): Promise<LifecycleOutcome>;
  cancel(externalRunRef: string, reasonRef: string): Promise<LifecycleOutcome>;
  events(externalRunRef: string, fromCursor?: number): Promise<LifecycleEvent[]>;
}

export const VALID_POINTER_SCHEMES = new Set([
  "contract",
  "adapter",
  "workspace",
  "host",
  "matt",
  "ariadne",
  "file",
  "human",
  "harness",
  "owner",
]);

export function isValidPointer(pointer: string): boolean {
  if (typeof pointer !== "string" || !pointer.trim()) return false;
  const match = /^([a-z0-9_-]+):\/\/(.+)$/iu.exec(pointer.trim());
  if (!match) return false;
  const scheme = match[1].toLowerCase();
  return VALID_POINTER_SCHEMES.has(scheme);
}

export function assertValidPointer(pointer: string, context = "pointer"): void {
  if (!isValidPointer(pointer)) {
    throw new Error(`Invalid ${context} scheme or format: ${pointer}`);
  }
}
