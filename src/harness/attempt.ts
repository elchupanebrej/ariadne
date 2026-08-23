import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assertOwnerScheme,
  sha256Digest,
  type LifecycleStatus,
} from "../adapters/lifecycle.js";

export interface OrchestrationAttempt {
  id: string;
  step?: string;
  status: LifecycleStatus;
  revision: number;
  dispatches: number;
  pins: string[];
  idempotencyKey?: string;
  deadline?: string;
  replayBudget: number;
  cursor: number;
  eventDigest?: string;
  cancellationIntent: boolean;
  ownerPointers: string[];
  pendingApprovalRef?: string;
}

export type AttemptAction =
  | "dispatch"
  | "resume_approval"
  | "acknowledge_cancellation"
  | "inspect_effects"
  | "complete"
  | "escalate";

export type AttemptReason =
  | "approval_not_bound_to_attempt"
  | "approval_expired"
  | "approval_deadline_invalid"
  | "host_permission_unverified"
  | "host_permission_lost"
  | "waiting_without_bound_approval"
  | "replay_budget_exhausted"
  | "mid_run_reset_effects_unknown"
  | "stale_revision"
  | "pin_mismatch"
  | "unsupported_capability"
  | "receipt_invalid"
  | "artifact_invalid"
  | "attempt_missing"
  | "ledger_corrupt"
  | "invalid_transition"
  | "cursor_conflict";

export interface AttemptDisposition {
  action: AttemptAction;
  approvalRef?: string;
  reason?: AttemptReason;
  authorityRef?: string;
  evidenceRefs?: string[];
  pendingAction?: string;
  resumePredicate?: string;
  deadline?: string;
}

export interface DispatchRequest {
  knownRevision: number;
  capability?: string;
  supportedCapabilities?: readonly string[];
  requestedPins?: string[];
}

export interface DispositionOptions {
  now?: () => Date;
  hasHostPermission?: (approvalRef: string) => Promise<boolean>;
  request?: DispatchRequest;
}

export class BoundaryError extends Error {
  constructor(
    readonly reason: AttemptReason,
    message: string,
  ) {
    super(message);
  }

  toDisposition(): AttemptDisposition {
    const profile = REASON_PROFILES[this.reason];
    return {
      action: "escalate",
      reason: this.reason,
      authorityRef: profile.authorityRef,
      evidenceRefs: [],
      pendingAction: profile.pendingAction,
      resumePredicate: profile.resumePredicate,
    };
  }
}

export interface CreateAttemptInput {
  id: string;
  step?: string;
  pins?: string[];
  idempotencyKey?: string;
  deadline?: string;
  replayBudget?: number;
}

const ATTEMPT_FIELDS = [
  "id",
  "step",
  "status",
  "revision",
  "dispatches",
  "pins",
  "idempotencyKey",
  "deadline",
  "replayBudget",
  "cursor",
  "eventDigest",
  "cancellationIntent",
  "ownerPointers",
  "pendingApprovalRef",
] as const;

export const pointerDigest = (pointer: string): string =>
  sha256Digest(`evt:${pointer}`).slice(0, 32);

export function createAttempt(input: CreateAttemptInput): OrchestrationAttempt {
  if (!input.id.trim()) throw new Error("Attempt id must not be empty");
  return {
    id: input.id,
    step: input.step,
    status: "created",
    revision: 1,
    dispatches: 0,
    pins: [...(input.pins ?? [])],
    idempotencyKey: input.idempotencyKey,
    deadline: input.deadline,
    replayBudget: input.replayBudget ?? 0,
    cursor: 0,
    cancellationIntent: false,
    ownerPointers: [],
  };
}

export function applyEvent(
  attempt: OrchestrationAttempt,
  cursor: number,
  digest: string,
): OrchestrationAttempt {
  if (cursor === attempt.cursor && digest === attempt.eventDigest) {
    return attempt;
  }
  if (cursor === attempt.cursor + 1) {
    return { ...attempt, cursor, eventDigest: digest, revision: attempt.revision + 1 };
  }
  throw new BoundaryError(
    "cursor_conflict",
    `Cannot advance attempt ${attempt.id}: cursor conflict, gap, or regression (have ${attempt.cursor}, received ${cursor})`,
  );
}

const TERMINAL_STATUSES: ReadonlySet<LifecycleStatus> = new Set([
  "succeeded",
  "failed",
  "canceled",
]);

const VALID_TRANSITIONS: Record<LifecycleStatus, readonly LifecycleStatus[]> = {
  created: ["running", "waiting", "failed", "canceled"],
  running: ["waiting", "succeeded", "failed", "canceled"],
  waiting: ["running", "failed", "canceled"],
  succeeded: [],
  failed: [],
  canceled: [],
};

export function transition(
  attempt: OrchestrationAttempt,
  newStatus: LifecycleStatus,
): OrchestrationAttempt {
  if (!VALID_TRANSITIONS[attempt.status].includes(newStatus)) {
    throw new BoundaryError(
      "invalid_transition",
      `Cannot transition attempt ${attempt.id} from ${attempt.status} to ${newStatus}`,
    );
  }
  return { ...attempt, status: newStatus, revision: attempt.revision + 1 };
}

interface ReasonProfile {
  authorityRef: string;
  pendingAction: string;
  resumePredicate: string;
}

// One stable profile per boundary reason: the same reason always yields the
// same authority pointer, pending action, and checkable resume predicate.
const REASON_PROFILES: Record<AttemptReason, ReasonProfile> = {
  approval_not_bound_to_attempt: {
    authorityRef: "harness://authority/pin-integrity",
    pendingAction: "harness://pending/bind-approval",
    resumePredicate: "approval pointer present in attempt.pins",
  },
  approval_expired: {
    authorityRef: "host://authority/approval-renewal",
    pendingAction: "host://pending/renew-approval",
    resumePredicate: "bound approval carries a future deadline",
  },
  approval_deadline_invalid: {
    authorityRef: "host://authority/approval-renewal",
    pendingAction: "host://pending/repair-deadline",
    resumePredicate: "attempt.deadline parses as a timestamp",
  },
  host_permission_unverified: {
    authorityRef: "host://authority/permission",
    pendingAction: "host://pending/revalidate-permission",
    resumePredicate: "host permission callback confirms approval",
  },
  host_permission_lost: {
    authorityRef: "host://authority/permission",
    pendingAction: "host://pending/revalidate-permission",
    resumePredicate: "host permission callback confirms approval",
  },
  waiting_without_bound_approval: {
    authorityRef: "harness://authority/pin-integrity",
    pendingAction: "harness://pending/bind-approval",
    resumePredicate: "waiting status carries a bound pendingApprovalRef",
  },
  replay_budget_exhausted: {
    authorityRef: "host://authority/dispatch-budget",
    pendingAction: "host://pending/raise-budget",
    resumePredicate: "dispatches below attempt.replayBudget",
  },
  mid_run_reset_effects_unknown: {
    authorityRef: "owner://authority/effect-inspection",
    pendingAction: "owner://pending/inspect-effects",
    resumePredicate: "owner inspection receipt recorded for in-flight effects",
  },
  stale_revision: {
    authorityRef: "harness://authority/revision-control",
    pendingAction: "harness://pending/refresh-attempt-state",
    resumePredicate: "caller revision matches attempt.revision",
  },
  pin_mismatch: {
    authorityRef: "harness://authority/pin-integrity",
    pendingAction: "harness://pending/reconcile-pins",
    resumePredicate: "requested pins all present in attempt.pins",
  },
  unsupported_capability: {
    authorityRef: "host://authority/capability-selection",
    pendingAction: "host://pending/select-capability",
    resumePredicate: "requested capability declared by provider set",
  },
  receipt_invalid: {
    authorityRef: "owner://authority/evidence",
    pendingAction: "owner://pending/supply-valid-receipt",
    resumePredicate: "receipt pointer uses matt, ariadne, host, or owner scheme",
  },
  artifact_invalid: {
    authorityRef: "owner://authority/evidence",
    pendingAction: "owner://pending/supply-valid-artifact",
    resumePredicate: "artifact pointer uses the file scheme",
  },
  ledger_corrupt: {
    authorityRef: "harness://authority/manual-recovery",
    pendingAction: "harness://pending/manual-recovery",
    resumePredicate: "committed ledger history parses and revisions ascend",
  },
  attempt_missing: {
    authorityRef: "host://authority/attempt-registration",
    pendingAction: "host://pending/register-attempt",
    resumePredicate: "attempt id exists under <root>/attempts/",
  },
  invalid_transition: {
    authorityRef: "harness://authority/lifecycle",
    pendingAction: "harness://pending/repair-lifecycle",
    resumePredicate: "requested status follows VALID_TRANSITIONS edges",
  },
  cursor_conflict: {
    authorityRef: "harness://authority/event-ledger",
    pendingAction: "harness://pending/reconcile-event-cursor",
    resumePredicate: "event cursor advances exactly one with matching digest",
  },
};

function enrichedDisposition(
  action: AttemptAction,
  reason: AttemptReason,
  evidenceRefs: string[],
  deadline?: string,
): AttemptDisposition {
  const profile = REASON_PROFILES[reason];
  return {
    action,
    reason,
    authorityRef: profile.authorityRef,
    evidenceRefs,
    pendingAction: profile.pendingAction,
    resumePredicate: profile.resumePredicate,
    deadline,
  };
}

const failedDisposition = (
  reason: AttemptReason,
  evidenceRefs: string[],
  deadline?: string,
): AttemptDisposition => enrichedDisposition("escalate", reason, evidenceRefs, deadline);

export function nextDisposition(
  attempt: OrchestrationAttempt,
  options: DispositionOptions = {},
): Promise<AttemptDisposition> {
  return decide(attempt, options);
}

async function decide(
  attempt: OrchestrationAttempt,
  options: DispositionOptions,
): Promise<AttemptDisposition> {
  if (TERMINAL_STATUSES.has(attempt.status)) {
    return { action: "complete" };
  }
  if (attempt.cancellationIntent) {
    return { action: "acknowledge_cancellation" };
  }
  if (attempt.status === "waiting") {
    return decideApproval(attempt, options);
  }
  // An existing Dispatch Intent (running status) routes to inspection rather
  // than another invocation.
  if (attempt.status === "running") {
    return enrichedDisposition(
      "inspect_effects",
      "mid_run_reset_effects_unknown",
      attempt.ownerPointers,
      attempt.deadline,
    );
  }
  return planDispatch(attempt, options);
}

async function planDispatch(
  attempt: OrchestrationAttempt,
  options: DispositionOptions,
): Promise<AttemptDisposition> {
  const request = options.request;
  const deadline = attempt.deadline;
  if (!request) {
    // Without a declared known revision, freshness cannot be proven and
    // dispatch cannot be granted.
    return failedDisposition("stale_revision", [], deadline);
  }
  if (request.knownRevision !== attempt.revision) {
    return failedDisposition("stale_revision", [`harness://revision/${attempt.revision}`], deadline);
  }
  if (
    request.capability !== undefined &&
    (!request.supportedCapabilities ||
      !request.supportedCapabilities.includes(request.capability))
  ) {
    return failedDisposition(
      "unsupported_capability",
      [`adapter://capability/${request.capability}`],
      deadline,
    );
  }
  if (request.requestedPins?.some((pin) => !attempt.pins.includes(pin))) {
    return failedDisposition("pin_mismatch", [...attempt.pins], deadline);
  }
  if (attempt.dispatches >= attempt.replayBudget) {
    return failedDisposition("replay_budget_exhausted", [], deadline);
  }
  return { action: "dispatch", deadline };
}

// ponytail: single `deadline` serves both dispatch and approval windows; split
// into per-concern deadlines if an approval ever needs its own expiry.
async function decideApproval(
  attempt: OrchestrationAttempt,
  options: DispositionOptions,
): Promise<AttemptDisposition> {
  const ref = attempt.pendingApprovalRef;
  if (!ref) {
    return failedDisposition("waiting_without_bound_approval", [], attempt.deadline);
  }
  if (!attempt.pins.includes(ref)) {
    return failedDisposition("approval_not_bound_to_attempt", [ref], attempt.deadline);
  }
  if (attempt.deadline !== undefined && !Number.isFinite(Date.parse(attempt.deadline))) {
    return failedDisposition("approval_deadline_invalid", [ref], attempt.deadline);
  }
  const now = (options.now ?? (() => new Date()))();
  if (attempt.deadline && now > new Date(attempt.deadline)) {
    return failedDisposition("approval_expired", [ref], attempt.deadline);
  }
  if (!options.hasHostPermission) {
    return failedDisposition("host_permission_unverified", [ref], attempt.deadline);
  }
  if (!(await options.hasHostPermission(ref))) {
    return failedDisposition("host_permission_lost", [ref], attempt.deadline);
  }
  return { action: "resume_approval", approvalRef: ref, deadline: attempt.deadline };
}

const attemptsDir = (rootDirectory: string): string => join(rootDirectory, "attempts");
const attemptPath = (rootDirectory: string, id: string): string =>
  join(attemptsDir(rootDirectory), `${id}.jsonl`);

function serialize(attempt: OrchestrationAttempt): string {
  const record: Record<string, unknown> = {};
  for (const field of ATTEMPT_FIELDS) {
    if (attempt[field] !== undefined) record[field] = attempt[field];
  }
  return `${JSON.stringify(record)}\n`;
}

// ponytail: append-only JSONL snapshots; concurrent writers need file locking
// or a revision compare-and-swap if that ever happens.
export async function saveAttempt(
  rootDirectory: string,
  attempt: OrchestrationAttempt,
): Promise<void> {
  await mkdir(attemptsDir(rootDirectory), { recursive: true });
  await appendFile(attemptPath(rootDirectory, attempt.id), serialize(attempt), "utf8");
}

export async function loadAttempt(
  rootDirectory: string,
  id: string,
): Promise<OrchestrationAttempt> {
  let raw: string;
  try {
    raw = await readFile(attemptPath(rootDirectory, id), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new BoundaryError("attempt_missing", `Attempt not found in repository-visible state: ${id}`);
    }
    throw new BoundaryError("ledger_corrupt", `Cannot read attempt ${id}: ${String(error)}`);
  }
  return recoverLedger(id, raw);
}

const LIFECYCLE_STATUSES: ReadonlySet<string> = new Set([
  "created",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "canceled",
]);

function isValidRecord(
  parsed: Record<string, unknown>,
  id: string,
  expectedRevision: number,
): boolean {
  return (
    parsed["id"] === id &&
    parsed["revision"] === expectedRevision &&
    typeof parsed["status"] === "string" &&
    LIFECYCLE_STATUSES.has(parsed["status"]) &&
    typeof parsed["dispatches"] === "number" &&
    typeof parsed["replayBudget"] === "number" &&
    typeof parsed["cursor"] === "number" &&
    typeof parsed["cancellationIntent"] === "boolean" &&
    Array.isArray(parsed["pins"]) &&
    Array.isArray(parsed["ownerPointers"])
  );
}

// Recovery accepts at most an incomplete final local record; corruption or a
// revision break anywhere in earlier committed history fails closed.
function recoverLedger(id: string, raw: string): OrchestrationAttempt {
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  let previousRevision = 0;
  let latest: OrchestrationAttempt | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const isFinalLine = index === lines.length - 1;
    const failClosed = (detail: string): BoundaryError =>
      new BoundaryError(
        "ledger_corrupt",
        `${detail} at line ${index + 1} of attempt ${id}; fail closed`,
      );
    let parsed: Record<string, unknown> | undefined;
    try {
      parsed = JSON.parse(lines[index]) as Record<string, unknown>;
    } catch {
      // Unparseable line.
    }
    if (!parsed || !isValidRecord(parsed, id, previousRevision + 1)) {
      if (!isFinalLine) {
        throw failClosed(
          parsed ? "Invalid committed history" : "Corrupted committed history",
        );
      }
      // An incomplete final local record is tolerated; fall back to the last
      // committed one.
      break;
    }
    previousRevision += 1;
    latest = parsed as unknown as OrchestrationAttempt;
  }
  if (!latest) {
    throw new BoundaryError("ledger_corrupt", `No recoverable record for attempt ${id}`);
  }
  return latest;
}

export async function reconstructNextAction(
  rootDirectory: string,
  id: string,
  options: DispositionOptions = {},
): Promise<AttemptDisposition> {
  return nextDisposition(await loadAttempt(rootDirectory, id), options);
}

export interface DirectResultJoinRequest {
  receiptRef: string;
  artifactRef?: string;
}

export type JoinDirectResultOutcome =
  | { ok: true; attempt: OrchestrationAttempt }
  | (AttemptDisposition & {
      ok: false;
      reason: Extract<AttemptReason, "receipt_invalid" | "artifact_invalid">;
    });

export async function joinDirectResult(
  rootDirectory: string,
  id: string,
  request: DirectResultJoinRequest,
): Promise<JoinDirectResultOutcome> {
  try {
    assertOwnerScheme(request.receiptRef, ["matt", "ariadne", "host", "owner"], "receiptRef");
  } catch {
    return {
      ok: false,
      ...failedDisposition("receipt_invalid", [request.receiptRef]),
    } as JoinDirectResultOutcome;
  }
  if (request.artifactRef) {
    try {
      assertOwnerScheme(request.artifactRef, ["file"], "artifactRef");
    } catch {
      return {
        ok: false,
        ...failedDisposition("artifact_invalid", [request.artifactRef]),
      } as JoinDirectResultOutcome;
    }
  }

  const attempt = await loadAttempt(rootDirectory, id);
  if (attempt.ownerPointers.includes(request.receiptRef)) {
    return { ok: true, attempt };
  }
  // ponytail: single-writer JSONL ledger without CAS; concurrent writers need
  // file locking or a revision compare-and-swap if that ever happens.
  const advanced = applyEvent(attempt, attempt.cursor + 1, pointerDigest(request.receiptRef));
  const ownerPointers = [...attempt.ownerPointers, request.receiptRef];
  if (request.artifactRef && !ownerPointers.includes(request.artifactRef)) {
    ownerPointers.push(request.artifactRef);
  }
  const joined: OrchestrationAttempt = { ...advanced, ownerPointers };
  await saveAttempt(rootDirectory, joined);
  return { ok: true, attempt: joined };
}

