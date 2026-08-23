import { createHash } from "node:crypto";

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
  authorityRef?: string;
  resumePredicate?: string;
  deadline?: string;
  reason?: string;
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

export function parsePointerScheme(pointer: string): string | undefined {
  if (typeof pointer !== "string" || !pointer.trim()) return undefined;
  const match = /^([a-z0-9_-]+):\/\/(.+)$/iu.exec(pointer.trim());
  return match ? match[1].toLowerCase() : undefined;
}

export function isValidPointer(pointer: string): boolean {
  const scheme = parsePointerScheme(pointer);
  return scheme !== undefined && VALID_POINTER_SCHEMES.has(scheme);
}

export function assertValidPointer(pointer: string, context = "pointer"): void {
  if (!isValidPointer(pointer)) {
    throw new Error(`Invalid ${context} scheme or format: ${pointer}`);
  }
}

export function assertOwnerScheme(
  pointer: string,
  expectedSchemes: string | string[],
  context = "pointer",
): void {
  assertValidPointer(pointer, context);
  const scheme = parsePointerScheme(pointer);
  const allowed = Array.isArray(expectedSchemes) ? expectedSchemes : [expectedSchemes];
  if (!scheme || !allowed.includes(scheme)) {
    throw new Error(
      `Owner mismatch for ${context}: expected [${allowed.join(", ")}], received scheme '${scheme}' in ${pointer}`,
    );
  }
}

export function sha256Digest(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
