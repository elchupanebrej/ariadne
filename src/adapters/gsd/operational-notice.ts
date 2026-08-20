import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
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
  timestamp?: string;
  created_at?: string;
};

export type NoticeWriter = (banner: string) => unknown | Promise<unknown>;

export type OperationalNoticeOptions = GsdDetectionOptions & {
  writer?: NoticeWriter;
  now?: () => string;
};

export const OPERATIONAL_NOTICE_BANNER = "⚠️ ARIADNE OPERATIONAL NOTICE";

// ponytail: this queue is process-local; use a file lock if multiple processes write one overlay.
const pathQueues = new Map<string, Promise<void>>();

const enqueue = (path: string, operation: () => Promise<void>): Promise<void> => {
  const previous = pathQueues.get(path) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation);
  pathQueues.set(path, current);
  return current.finally(() => {
    if (pathQueues.get(path) === current) pathQueues.delete(path);
  });
};

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeInput = (input: OperationalNoticeInput): {
  falsifiedId: string;
  evidenceId: string;
  affectedIds: string[];
  reason: string;
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

  const notices: OperationalNotice[] = [];
  for (const line of contents.split("\n").filter((line) => line.trim())) {
    const parsed = OperationalNoticeSchema.safeParse(JSON.parse(line));
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

const updateState = async (statePath: string, noticeId: string): Promise<void> => {
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
  await writeFile(
    temporaryPath,
    `${JSON.stringify({ ...state, active_notices: current }, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, statePath);
};

export function renderOperationalNoticeBanner(notice: OperationalNotice): string {
  return [
    OPERATIONAL_NOTICE_BANNER,
    `Notice: ${notice.id}`,
    `Falsified: ${notice.falsified_id}`,
    `Evidence: ${notice.evidence_id}`,
    `Affected: ${notice.affected_ids.join(", ")}`,
    `Reason: ${notice.reason}`,
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
  if (!environment.active) throw new Error("GSD is not active; operational notice requires .planning");

  const normalized = normalizeInput(input);
  const noticesPath = join(environment.overlayPath, "NOTICES.jsonl");
  const statePath = join(environment.overlayPath, "STATE.yaml");
  let result: OperationalNotice | undefined;
  let created = false;

  await enqueue(noticesPath, async () => {
    await mkdir(environment.overlayPath, { recursive: true });
    const notices = await readNotices(noticesPath);
    result = notices.find(
      (notice) =>
        notice.falsified_id === normalized.falsifiedId &&
        notice.evidence_id === normalized.evidenceId,
    );
    if (!result) {
      result = OperationalNoticeSchema.parse({
        kind: "operational_notice",
        id: nextNoticeId(notices),
        falsified_id: normalized.falsifiedId,
        evidence_id: normalized.evidenceId,
        affected_ids: normalized.affectedIds,
        reason: normalized.reason,
        message: normalized.reason,
        created_at: normalized.createdAt,
      });
      await appendFile(noticesPath, `${JSON.stringify(result)}\n`, "utf8");
      created = true;
    }
    await updateState(statePath, result.id);
  });

  if (!result) throw new Error("Operational notice was not created");
  if (created) {
    const writer = options.writer ?? ((banner: string) => process.stdout.write(`${banner}\n`));
    await writer(renderOperationalNoticeBanner(result));
  }
  return result;
}

export const emitOperationalNotice = emitGsdOperationalNotice;
export const createOperationalNotice = emitGsdOperationalNotice;
