import { mkdir, readFile, rename, rm, stat, truncate, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { z } from "zod";
import { detectGsd, type GsdDetectionOptions } from "./detector.js";

const nodeId = "[0-9A-Za-z_-]+";

export const OperationalNoticeSchema = z
  .object({
    kind: z.literal("operational_notice"),
    id: z.string().regex(new RegExp(`^NOT-${nodeId}$`)),
    falsified_id: z.string().regex(new RegExp(`^(?:ASM|HYP)-${nodeId}$`)),
    evidence_id: z.string().regex(new RegExp(`^EVD-${nodeId}$`)),
    affected_ids: z.array(z.string().regex(new RegExp(`^[A-Z][A-Z0-9-]*-${nodeId}$`))).min(1),
    reason: z.string().min(1),
    message: z.string().min(1),
    owner: z.string().min(1).default("Ariadne"),
    next_action: z
      .string()
      .min(1)
      .default("Review the affected nodes and select the next candidate"),
    revaluation_condition: z
      .string()
      .min(1)
      .default("Re-evaluate when new evidence addresses the falsified premise"),
    created_at: z.string().datetime(),
  })
  .passthrough();

export type OperationalNotice = z.infer<typeof OperationalNoticeSchema>;

export type OperationalNoticeInput = {
  falsifiedId?: string;
  falsified_id?: string;
  evidenceId?: string;
  evidence_id?: string;
  affectedIds?: string[];
  affected_ids?: string[];
  reason?: string;
  message?: string;
  owner?: string;
  nextAction?: string;
  next_action?: string;
  revaluationCondition?: string;
  revaluation_condition?: string;
  timestamp?: string;
  created_at?: string;
};

export type NoticeWriter = (banner: string) => unknown | Promise<unknown>;

export type OperationalNoticeOptions = GsdDetectionOptions & {
  writer?: NoticeWriter;
  now?: () => string;
};

export const OPERATIONAL_NOTICE_BANNER = "⚠️ ARIADNE OPERATIONAL NOTICE";

const pathQueues = new Map<string, Promise<void>>();

const enqueue = (path: string, operation: () => Promise<void>): Promise<void> => {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pathQueues.set(path, current);
  return current.finally(() => {
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  });
};

const LOCK_WAIT_MS = 10;
const LOCK_STALE_MS = 5 * 60_000;

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const withFileLock = async <T>(
  lockPath: string,
  operation: () => Promise<T>,
): Promise<T> => {
  await mkdir(dirname(lockPath), { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      await mkdir(lockPath);
      await writeFile(join(lockPath, "owner"), `${process.pid}\n`, "utf8");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const age = Date.now() - (await stat(lockPath)).mtimeMs;
        if (age > LOCK_STALE_MS) await rm(lockPath, { recursive: true, force: true });
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== "ENOENT") throw statError;
      }
      if (Date.now() - startedAt > LOCK_STALE_MS) {
        throw new Error(`Timed out waiting for notice lock: ${lockPath}`);
      }
      await sleep(LOCK_WAIT_MS);
    }
  }

  try {
    return await operation();
  } finally {
    await rm(lockPath, { recursive: true, force: true });
  }
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeInput = (input: OperationalNoticeInput): {
  falsifiedId: string;
  evidenceId: string;
  affectedIds: string[];
  reason: string;
  owner: string;
  nextAction: string;
  revaluationCondition: string;
  createdAt: string;
} => {
  const falsifiedId = input.falsifiedId ?? input.falsified_id;
  const evidenceId = input.evidenceId ?? input.evidence_id;
  const affectedIds = input.affectedIds ?? input.affected_ids;
  if (!falsifiedId || !/^(?:ASM|HYP)-[0-9A-Za-z_-]+$/u.test(falsifiedId)) {
    throw new Error("Operational notice requires an ASM-* or HYP-* falsified id");
  }
  if (!evidenceId || !/^EVD-[0-9A-Za-z_-]+$/u.test(evidenceId)) {
    throw new Error("Operational notice requires an EVD-* evidence id");
  }
  if (!affectedIds || affectedIds.length === 0 || affectedIds.some((id) => !nonEmpty(id))) {
    throw new Error("Operational notice requires at least one affected id");
  }

  const createdAt = input.timestamp ?? input.created_at ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(createdAt))) throw new Error("Operational notice timestamp is invalid");

  return {
    falsifiedId,
    evidenceId,
    affectedIds: [...new Set(affectedIds.map((id) => id.trim()))].sort(),
    reason:
      input.reason?.trim() ||
      input.message?.trim() ||
      `Evidence ${evidenceId} falsifies ${falsifiedId}`,
    owner: input.owner?.trim() || "Ariadne",
    nextAction:
      input.nextAction?.trim() ||
      input.next_action?.trim() ||
      "Review the affected nodes and select the next candidate",
    revaluationCondition:
      input.revaluationCondition?.trim() ||
      input.revaluation_condition?.trim() ||
      "Re-evaluate when new evidence addresses the falsified premise",
    createdAt: new Date(createdAt).toISOString(),
  };
};

const readNotices = async (path: string): Promise<OperationalNotice[]> => {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const hasFinalNewline = contents.endsWith("\n");
  const lines = contents.split("\n");
  if (hasFinalNewline) lines.pop();
  const notices: OperationalNotice[] = [];
  const lastMeaningfulIndex = lines.reduce(
    (last, line, index) => (line.trim() ? index : last),
    -1,
  );
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || !line.trim()) continue;
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      if (index !== lastMeaningfulIndex) throw error;
      const offset = Buffer.byteLength(lines.slice(0, index).join("\n"));
      await truncate(path, offset === 0 ? 0 : offset + 1);
      return notices;
    }
    const parsed = OperationalNoticeSchema.safeParse(value);
    if (parsed.success) notices.push(parsed.data);
  }
  return notices;
};

const nextNoticeId = (notices: OperationalNotice[]): string => {
  const next = notices.reduce((maximum, notice) => {
    const number = /^NOT-(\d+)$/u.exec(notice.id)?.[1];
    return Math.max(maximum, number ? Number(number) : 0);
  }, 0) + 1;
  return `NOT-${String(next).padStart(3, "0")}`;
};

const writeNotices = async (
  noticesPath: string,
  notices: readonly OperationalNotice[],
): Promise<void> => {
  const temporaryPath = `${noticesPath}.${randomUUID()}.tmp`;
  try {
    await writeFile(
      temporaryPath,
      notices.length > 0 ? `${notices.map((notice) => JSON.stringify(notice)).join("\n")}\n` : "",
      "utf8",
    );
    await rename(temporaryPath, noticesPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const updateState = async (statePath: string, noticeId: string): Promise<void> => {
  await withFileLock(`${statePath}.lock`, async () => {
    let state: Record<string, unknown> = {};
    try {
      state = JSON.parse(await readFile(statePath, "utf8")) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    const current = Array.isArray(state.active_notices)
      ? state.active_notices.filter((id): id is string => typeof id === "string")
      : [];
    if (!current.includes(noticeId)) current.push(noticeId);

    const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        `${JSON.stringify({ ...state, active_notices: current }, null, 2)}\n`,
        "utf8",
      );
      await rename(temporaryPath, statePath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  });
};

export function renderOperationalNoticeBanner(notice: OperationalNotice): string {
  return [
    OPERATIONAL_NOTICE_BANNER,
    `Notice: ${notice.id}`,
    `Falsified: ${notice.falsified_id}`,
    `Evidence: ${notice.evidence_id}`,
    `Affected: ${notice.affected_ids.join(", ")}`,
    `Reason: ${notice.reason}`,
    `Owner: ${notice.owner}`,
    `Next action: ${notice.next_action}`,
    `Revaluation: ${notice.revaluation_condition}`,
  ].join("\n");
}

export async function emitGsdOperationalNotice(
  rootDirectory: string,
  input: OperationalNoticeInput,
  writerOrOptions: NoticeWriter | OperationalNoticeOptions = {},
): Promise<OperationalNotice> {
  const options: OperationalNoticeOptions =
    typeof writerOrOptions === "function" ? { writer: writerOrOptions } : writerOrOptions;
  const environment = detectGsd(rootDirectory, options);

  const normalized = normalizeInput(input);
  const noticesPath = join(environment.storageRoot, "NOTICES.jsonl");
  const statePath = join(environment.storageRoot, "STATE.yaml");
  let result: OperationalNotice | undefined;
  let created = false;

  await enqueue(noticesPath, () =>
    withFileLock(`${noticesPath}.lock`, async () => {
      await mkdir(environment.storageRoot, { recursive: true });
      const notices = await readNotices(noticesPath);
      result = notices.find(
        (notice) =>
          notice.falsified_id === normalized.falsifiedId &&
          notice.evidence_id === normalized.evidenceId,
      );
      if (!result) {
        const notice = OperationalNoticeSchema.parse({
          kind: "operational_notice",
          id: nextNoticeId(notices),
          falsified_id: normalized.falsifiedId,
          evidence_id: normalized.evidenceId,
          affected_ids: normalized.affectedIds,
          reason: normalized.reason,
          message: normalized.reason,
          owner: normalized.owner,
          next_action: normalized.nextAction,
          revaluation_condition: normalized.revaluationCondition,
          created_at: normalized.createdAt,
        });
        result = notice;
        await writeNotices(noticesPath, [...notices, notice]);
        created = true;
      }
      await updateState(statePath, result.id);
    }),
  );

  if (!result) throw new Error("Operational notice was not created");
  if (created) {
    const writer = options.writer ?? ((banner: string) => process.stdout.write(`${banner}\n`));
    await writer(renderOperationalNoticeBanner(result));
  }
  return result;
}

export const emitOperationalNotice = emitGsdOperationalNotice;
export const createOperationalNotice = emitGsdOperationalNotice;
