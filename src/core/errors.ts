/**
 * Unified diagnostic vocabulary, error representation, and formatters
 * for Ariadne.
 */

export const DIAGNOSTIC_CODES = [
  "INVALID_INPUT",
  "MISSING_DATA",
  "CORRUPT_PERSISTED_HISTORY",
  "INCOMPLETE_TAIL",
  "UNSUPPORTED_FORMAT",
  "MIGRATION_REQUIRED",
  "LOCK_CONTENTION",
  "LOCK_OWNERSHIP_UNCERTAIN",
  "PERMISSION_DENIED",
  "PATH_ESCAPE",
  "INVARIANT_VIOLATION",
  "IDEMPOTENCY_CONFLICT",
  "COMMIT_UNKNOWN",
  "TIMEOUT",
  "CAPACITY_EXCEEDED",
  "PROJECTION_RECOVERY_NEEDED",
  "COMMAND_FAILED",
  "GATE_FAILED",
  "MERGE_DIVERGED",
] as const;

export type DiagnosticCode = (typeof DIAGNOSTIC_CODES)[number];

export type ExitStatusClass = 1 | 2;

export const EXIT_STATUS_BY_CODE: Record<DiagnosticCode, ExitStatusClass> = {
  INVALID_INPUT: 2,
  MISSING_DATA: 2,
  CORRUPT_PERSISTED_HISTORY: 2,
  INCOMPLETE_TAIL: 2,
  UNSUPPORTED_FORMAT: 2,
  MIGRATION_REQUIRED: 2,
  LOCK_CONTENTION: 2,
  LOCK_OWNERSHIP_UNCERTAIN: 2,
  PERMISSION_DENIED: 2,
  PATH_ESCAPE: 2,
  INVARIANT_VIOLATION: 2,
  IDEMPOTENCY_CONFLICT: 2,
  COMMIT_UNKNOWN: 2,
  TIMEOUT: 2,
  CAPACITY_EXCEEDED: 2,
  PROJECTION_RECOVERY_NEEDED: 1,
  COMMAND_FAILED: 1,
  GATE_FAILED: 1,
  MERGE_DIVERGED: 1,
};

export function exitCodeFor(code: DiagnosticCode): ExitStatusClass {
  return EXIT_STATUS_BY_CODE[code];
}

export type RepairTier = "mandatory" | "optional" | "none";

export const REPAIR_TIER_BY_CODE: Record<DiagnosticCode, RepairTier> = {
  CORRUPT_PERSISTED_HISTORY: "mandatory",
  INCOMPLETE_TAIL: "mandatory",
  UNSUPPORTED_FORMAT: "mandatory",
  MIGRATION_REQUIRED: "mandatory",
  LOCK_CONTENTION: "mandatory",
  LOCK_OWNERSHIP_UNCERTAIN: "mandatory",
  COMMIT_UNKNOWN: "mandatory",
  CAPACITY_EXCEEDED: "mandatory",
  PROJECTION_RECOVERY_NEEDED: "mandatory",
  INVALID_INPUT: "optional",
  MISSING_DATA: "optional",
  PERMISSION_DENIED: "optional",
  PATH_ESCAPE: "optional",
  TIMEOUT: "optional",
  INVARIANT_VIOLATION: "none",
  IDEMPOTENCY_CONFLICT: "none",
  COMMAND_FAILED: "none",
  GATE_FAILED: "none",
  MERGE_DIVERGED: "none",
};

export function repairTierFor(code: DiagnosticCode): RepairTier {
  return REPAIR_TIER_BY_CODE[code];
}

export class AriadneError extends Error {
  public readonly code: DiagnosticCode;
  public readonly repair?: string;
  public readonly detail?: Record<string, unknown>;

  constructor(options: {
    code: DiagnosticCode;
    message: string;
    repair?: string;
    detail?: Record<string, unknown>;
  }) {
    super(options.message);
    this.name = "AriadneError";
    this.code = options.code;
    this.repair = options.repair;
    this.detail = options.detail;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAriadneError(error: unknown): error is AriadneError {
  return error instanceof AriadneError;
}

export interface DiagnosticPayload {
  code: DiagnosticCode;
  message: string;
  repair?: string;
  detail?: Record<string, unknown>;
}

export interface FormatDiagnosticOptions {
  json?: boolean;
}

export interface FormattedDiagnostic {
  exitCode: number;
  text: string;
}

function cleanDiagnosticPayload(payload: DiagnosticPayload): Record<string, unknown> {
  const result: Record<string, unknown> = {
    code: payload.code,
    message: payload.message,
  };
  if (payload.repair !== undefined) {
    result.repair = payload.repair;
  }
  if (payload.detail !== undefined) {
    result.detail = payload.detail;
  }
  return result;
}

export function toDiagnosticPayload(error: unknown): { payload: DiagnosticPayload; exitCode: number } {
  if (error instanceof AriadneError) {
    const payload: DiagnosticPayload = {
      code: error.code,
      message: error.message,
    };
    if (error.repair !== undefined) {
      payload.repair = error.repair;
    }
    if (error.detail !== undefined) {
      payload.detail = error.detail;
    }
    return { payload, exitCode: exitCodeFor(error.code) };
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code in EXIT_STATUS_BY_CODE
  ) {
    const candidate = error as {
      code: DiagnosticCode;
      message?: unknown;
      repair?: unknown;
      detail?: unknown;
    };
    const payload: DiagnosticPayload = {
      code: candidate.code,
      message: typeof candidate.message === "string" ? candidate.message : String(error),
    };
    if (typeof candidate.repair === "string") {
      payload.repair = candidate.repair;
    }
    if (typeof candidate.detail === "object" && candidate.detail !== null) {
      payload.detail = candidate.detail as Record<string, unknown>;
    }
    return { payload, exitCode: exitCodeFor(candidate.code) };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    payload: {
      code: "INVARIANT_VIOLATION",
      message,
    },
    exitCode: 2,
  };
}

export function formatHumanDiagnostic(error: unknown): string {
  const { payload } = toDiagnosticPayload(error);
  if (payload.repair) {
    return `Error: [${payload.code}] ${payload.message}\nRepair: ${payload.repair}\n`;
  }
  return `Error: [${payload.code}] ${payload.message}\n`;
}

export function formatJsonDiagnostic(error: unknown): string {
  if (Array.isArray(error)) {
    const cleaned = error.map((e) => cleanDiagnosticPayload(toDiagnosticPayload(e).payload));
    return `${JSON.stringify(cleaned, null, 2)}\n`;
  }

  const { payload, exitCode } = toDiagnosticPayload(error);
  const cleaned = cleanDiagnosticPayload(payload);
  if (exitCode === 1) {
    return `${JSON.stringify([cleaned], null, 2)}\n`;
  }
  return `${JSON.stringify(cleaned, null, 2)}\n`;
}

export function formatDiagnostic(
  error: unknown,
  options?: FormatDiagnosticOptions,
): FormattedDiagnostic {
  if (Array.isArray(error)) {
    const items = error.map((e) => toDiagnosticPayload(e));
    const exitCode = items.some((i) => i.exitCode === 2) ? 2 : 1;
    const text = options?.json
      ? formatJsonDiagnostic(error)
      : error.map((e) => formatHumanDiagnostic(e)).join("");
    return { exitCode, text };
  }

  const { exitCode } = toDiagnosticPayload(error);
  const text = options?.json
    ? formatJsonDiagnostic(error)
    : formatHumanDiagnostic(error);
  return { exitCode, text };
}
