import { mkdir, readFile, writeFile } from "node:fs/promises";
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

export interface AttemptDisposition {
  action: AttemptAction;
  approvalRef?: string;
  reason?: string;
}

export interface DispositionOptions {
  now?: () => Date;
  hasHostPermission?: (approvalRef: string) => Promise<boolean>;
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
  throw new Error(
    `Cannot advance attempt ${attempt.id}: cursor conflict or gap (have ${attempt.cursor}, received ${cursor})`,
  );
}

const TERMINAL_STATUSES: ReadonlySet<LifecycleStatus> = new Set([
  "succeeded",
  "failed",
  "canceled",
]);

// ponytail: single `deadline` serves both dispatch and approval windows; split
// into per-concern deadlines if an approval ever needs its own expiry.
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
  if (attempt.status === "running") {
    return { action: "inspect_effects", reason: "mid_run_reset_effects_unknown" };
  }
  if (attempt.dispatches >= attempt.replayBudget) {
    return { action: "escalate", reason: "replay_budget_exhausted" };
  }
  return { action: "dispatch" };
}

async function decideApproval(
  attempt: OrchestrationAttempt,
  options: DispositionOptions,
): Promise<AttemptDisposition> {
  const ref = attempt.pendingApprovalRef;
  if (!ref) {
    return { action: "escalate", reason: "waiting_without_bound_approval" };
  }
  if (!attempt.pins.includes(ref)) {
    return { action: "escalate", reason: "approval_not_bound_to_attempt" };
  }
  // ponytail: single-writer JSON ledger without CAS; concurrent writers need
  // file locking or a revision compare-and-swap if that ever happens.
  const now = (options.now ?? (() => new Date()))();
  if (attempt.deadline !== undefined && !Number.isFinite(Date.parse(attempt.deadline))) {
    return { action: "escalate", reason: "approval_deadline_invalid" };
  }
  if (attempt.deadline && now > new Date(attempt.deadline)) {
    return { action: "escalate", reason: "approval_expired" };
  }
  if (!options.hasHostPermission) {
    return { action: "escalate", reason: "host_permission_unverified" };
  }
  if (!(await options.hasHostPermission(ref))) {
    return { action: "escalate", reason: "host_permission_lost" };
  }
  return { action: "resume_approval", approvalRef: ref };
}

const attemptsDir = (rootDirectory: string): string => join(rootDirectory, "attempts");
const attemptPath = (rootDirectory: string, id: string): string =>
  join(attemptsDir(rootDirectory), `${id}.json`);

export async function saveAttempt(
  rootDirectory: string,
  attempt: OrchestrationAttempt,
): Promise<void> {
  const path = attemptPath(rootDirectory, attempt.id);
  await mkdir(join(path, ".."), { recursive: true });
  const persisted: Record<string, unknown> = {};
  for (const field of ATTEMPT_FIELDS) {
    if (attempt[field] !== undefined) persisted[field] = attempt[field];
  }
  await writeFile(path, `${JSON.stringify(persisted, null, 2)}\n`, "utf8");
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
      throw new Error(`Attempt not found in repository-visible state: ${id}`);
    }
    throw new Error(`Cannot read attempt ${id}: ${String(error)}`);
  }
  try {
    return JSON.parse(raw) as OrchestrationAttempt;
  } catch {
    throw new Error(`Corrupted attempt ledger for ${id}; fail closed`);
  }
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

export async function joinDirectResult(
  rootDirectory: string,
  id: string,
  request: DirectResultJoinRequest,
): Promise<OrchestrationAttempt> {
  assertOwnerScheme(request.receiptRef, ["matt", "ariadne", "host", "owner"], "receiptRef");
  if (request.artifactRef) assertOwnerScheme(request.artifactRef, ["file"], "artifactRef");

  const attempt = await loadAttempt(rootDirectory, id);
  if (attempt.ownerPointers.includes(request.receiptRef)) {
    return attempt;
  }
  // ponytail: single-writer JSON ledger without CAS; concurrent writers need
  // file locking or a revision compare-and-swap if that ever happens.
  const advanced = applyEvent(attempt, attempt.cursor + 1, pointerDigest(request.receiptRef));
  const ownerPointers = [...attempt.ownerPointers, request.receiptRef];
  if (request.artifactRef && !ownerPointers.includes(request.artifactRef)) {
    ownerPointers.push(request.artifactRef);
  }
  const joined: OrchestrationAttempt = { ...advanced, ownerPointers };
  await saveAttempt(rootDirectory, joined);
  return joined;
}
