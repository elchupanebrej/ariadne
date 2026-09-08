import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { detectGsd, type GsdDetectionOptions } from "./detector.js";
import { executeWriteCycle } from "../../graph/journal.js";

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

const nextNoticeId = (notices: OperationalNotice[]): string => {
  const next = notices.reduce((maximum, notice) => {
    const number = /^NOT-(\d+)$/u.exec(notice.id)?.[1];
    return Math.max(maximum, number ? Number(number) : 0);
  }, 0) + 1;
  return `NOT-${String(next).padStart(3, "0")}`;
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
  let created = false;
  const noticeKey = `operational-notice:${normalized.falsifiedId}:${normalized.evidenceId}`;
  const statePath = join(environment.storageRoot, "STATE.yaml");
  let recordMetadata: Record<string, unknown> = {};
  const outcome = await executeWriteCycle<OperationalNotice, OperationalNotice>({
    storageRoot: environment.storageRoot,
    authority: "notices",
    idempotencyKey: noticeKey,
    mutate: async ({ existingRecords }) => {
      const activeNoticeProjection = async (noticeId: string) => {
        let state: Record<string, unknown> = {};
        try {
          const raw = await readFile(statePath, "utf8");
          const parsed: unknown = JSON.parse(raw);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            state = parsed as Record<string, unknown>;
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const active = Array.isArray(state.active_notices)
          ? state.active_notices.filter((id): id is string => typeof id === "string")
          : [];
        if (!active.includes(noticeId)) active.push(noticeId);
        return {
          path: statePath,
          content: `${JSON.stringify({ ...state, schema_version: state.schema_version ?? 1, active_notices: active }, null, 2)}\n`,
        };
      };
      const notices = existingRecords.flatMap((record) => {
        const parsed = OperationalNoticeSchema.safeParse(record.payload);
        return parsed.success ? [parsed.data] : [];
      });
      const existing = notices.find(
        (notice) =>
          notice.falsified_id === normalized.falsifiedId &&
          notice.evidence_id === normalized.evidenceId,
      );
      if (existing) {
        return {
          payload: existing,
          result: existing,
          projections: [await activeNoticeProjection(existing.id)],
        };
      }

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
      recordMetadata = notice;
      created = true;
      return {
        payload: notice,
        result: notice,
        projections: [await activeNoticeProjection(notice.id)],
      };
    },
    // Preserve the adapter's historic direct-id projection while the payload
    // remains the only value consumed by the canonical reader.
    frameMetadata: () => recordMetadata,
  });

  if (outcome.outcome !== "committed") throw outcome.error;
  const result = outcome.result;
  if (created) {
    const writer = options.writer ?? ((banner: string) => process.stdout.write(`${banner}\n`));
    await writer(renderOperationalNoticeBanner(result));
  }
  return result;
}

export const emitOperationalNotice = emitGsdOperationalNotice;
export const createOperationalNotice = emitGsdOperationalNotice;
