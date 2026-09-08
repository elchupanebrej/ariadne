import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import {
  DIAGNOSTIC_CODES,
  type DiagnosticCode,
  EXIT_STATUS_BY_CODE,
  exitCodeFor,
  type ExitStatusClass,
  REPAIR_TIER_BY_CODE,
  repairTierFor,
  type RepairTier,
  AriadneError,
  isAriadneError,
  formatHumanDiagnostic,
  formatJsonDiagnostic,
  formatDiagnostic,
} from "../../src/core/errors.js";
import { runCli } from "../../src/cli/index.js";
import * as rootExports from "../../src/index.js";

const capture = () => {
  let output = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    },
  });
  return { stream, text: () => output };
};

describe("Diagnostic Codes Catalog", () => {
  const EXPECTED_CODES: DiagnosticCode[] = [
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
  ];

  it("defines exactly 19 diagnostic codes", () => {
    expect(DIAGNOSTIC_CODES).toHaveLength(19);
    expect([...DIAGNOSTIC_CODES]).toEqual(EXPECTED_CODES);
    expect(new Set(DIAGNOSTIC_CODES).size).toBe(19);
  });

  it("maps each diagnostic code to exactly one exit status class (1 or 2)", () => {
    const exit2Codes: DiagnosticCode[] = [
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
    ];

    const exit1Codes: DiagnosticCode[] = [
      "PROJECTION_RECOVERY_NEEDED",
      "COMMAND_FAILED",
      "GATE_FAILED",
      "MERGE_DIVERGED",
    ];

    for (const code of DIAGNOSTIC_CODES) {
      const exitClass = exitCodeFor(code);
      expect(exitClass).toBe(EXIT_STATUS_BY_CODE[code]);
      if (exit1Codes.includes(code)) {
        expect(exitClass).toBe(1);
      } else if (exit2Codes.includes(code)) {
        expect(exitClass).toBe(2);
      } else {
        throw new Error(`Unhandled code in test verification: ${code}`);
      }
    }
  });

  it("maps each diagnostic code to exactly one repair tier", () => {
    const mandatoryCodes: DiagnosticCode[] = [
      "CORRUPT_PERSISTED_HISTORY",
      "INCOMPLETE_TAIL",
      "UNSUPPORTED_FORMAT",
      "MIGRATION_REQUIRED",
      "LOCK_CONTENTION",
      "LOCK_OWNERSHIP_UNCERTAIN",
      "COMMIT_UNKNOWN",
      "CAPACITY_EXCEEDED",
      "PROJECTION_RECOVERY_NEEDED",
    ];

    const optionalCodes: DiagnosticCode[] = [
      "INVALID_INPUT",
      "MISSING_DATA",
      "PERMISSION_DENIED",
      "PATH_ESCAPE",
      "TIMEOUT",
    ];

    const noneCodes: DiagnosticCode[] = [
      "INVARIANT_VIOLATION",
      "IDEMPOTENCY_CONFLICT",
      "COMMAND_FAILED",
      "GATE_FAILED",
      "MERGE_DIVERGED",
    ];

    for (const code of DIAGNOSTIC_CODES) {
      const tier = repairTierFor(code);
      expect(tier).toBe(REPAIR_TIER_BY_CODE[code]);
      if (mandatoryCodes.includes(code)) {
        expect(tier).toBe("mandatory");
      } else if (optionalCodes.includes(code)) {
        expect(tier).toBe("optional");
      } else if (noneCodes.includes(code)) {
        expect(tier).toBe("none");
      } else {
        throw new Error(`Unhandled code in repair tier verification: ${code}`);
      }
    }
  });
});

describe("AriadneError Class", () => {
  it("instantiates with code and message", () => {
    const error = new AriadneError({
      code: "INVALID_INPUT",
      message: "Bad input provided",
    });

    expect(error.code).toBe("INVALID_INPUT");
    expect(error.message).toBe("Bad input provided");
    expect(error.name).toBe("AriadneError");
    expect(error.repair).toBeUndefined();
    expect(error.detail).toBeUndefined();
    expect(error instanceof AriadneError).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(Object.getPrototypeOf(error)).toBe(AriadneError.prototype);
    expect(isAriadneError(error)).toBe(true);
  });

  it("instantiates with repair and detail", () => {
    const detail = { path: "/tmp/foo", timeoutMs: 5000 };
    const error = new AriadneError({
      code: "LOCK_CONTENTION",
      message: "Could not acquire root lock",
      repair: "Kill the existing process holding the lock",
      detail,
    });

    expect(error.code).toBe("LOCK_CONTENTION");
    expect(error.message).toBe("Could not acquire root lock");
    expect(error.repair).toBe("Kill the existing process holding the lock");
    expect(error.detail).toEqual(detail);
  });

  it("type guard correctly distinguishes AriadneError from other values", () => {
    expect(isAriadneError(new AriadneError({ code: "TIMEOUT", message: "timed out" }))).toBe(true);
    expect(isAriadneError(new Error("regular error"))).toBe(false);
    expect(isAriadneError({ code: "TIMEOUT", message: "fake" })).toBe(false);
    expect(isAriadneError(null)).toBe(false);
    expect(isAriadneError(undefined)).toBe(false);
    expect(isAriadneError("string error")).toBe(false);
  });
});

describe("Diagnostic Formatters", () => {
  describe("formatHumanDiagnostic", () => {
    it("formats an AriadneError without repair", () => {
      const error = new AriadneError({
        code: "INVALID_INPUT",
        message: "Missing parameter --name",
      });
      const text = formatHumanDiagnostic(error);
      expect(text).toBe("Error: [INVALID_INPUT] Missing parameter --name\n");
    });

    it("formats an AriadneError with repair guidance", () => {
      const error = new AriadneError({
        code: "LOCK_CONTENTION",
        message: "Lock held by PID 1234",
        repair: "Wait for PID 1234 to finish or inspect .ariadne/.lock/owner.json",
      });
      const text = formatHumanDiagnostic(error);
      expect(text).toBe(
        "Error: [LOCK_CONTENTION] Lock held by PID 1234\nRepair: Wait for PID 1234 to finish or inspect .ariadne/.lock/owner.json\n",
      );
    });

    it("formats a non-AriadneError gracefully", () => {
      const error = new Error("Generic failure occurred");
      const text = formatHumanDiagnostic(error);
      expect(text).toBe("Error: [INVARIANT_VIOLATION] Generic failure occurred\n");
    });
  });

  describe("formatJsonDiagnostic", () => {
    it("serializes exit 2 fatal error as a single JSON object omitting undefined fields", () => {
      const error = new AriadneError({
        code: "LOCK_CONTENTION",
        message: "Failed to acquire root lock within 60000ms timeout.",
        repair: "Check for running ariadne processes or inspect .ariadne/.lock/owner.json.",
        detail: {
          lockPath: ".ariadne/.lock",
          timeoutMs: 60000,
          ownerPid: 4821,
        },
      });

      const output = formatJsonDiagnostic(error);
      expect(output.endsWith("\n")).toBe(true);
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        code: "LOCK_CONTENTION",
        message: "Failed to acquire root lock within 60000ms timeout.",
        repair: "Check for running ariadne processes or inspect .ariadne/.lock/owner.json.",
        detail: {
          lockPath: ".ariadne/.lock",
          timeoutMs: 60000,
          ownerPid: 4821,
        },
      });
    });

    it("omits repair and detail keys from JSON when undefined", () => {
      const error = new AriadneError({
        code: "INVALID_INPUT",
        message: "Malformed input",
      });

      const output = formatJsonDiagnostic(error);
      const parsed = JSON.parse(output);
      expect(parsed).toEqual({
        code: "INVALID_INPUT",
        message: "Malformed input",
      });
      expect(Object.keys(parsed)).toEqual(["code", "message"]);
    });

    it("serializes exit 1 domain verdicts as an array of diagnostic objects", () => {
      const error = new AriadneError({
        code: "GATE_FAILED",
        message: "Epistemic gate 'production-ready' failed verification.",
        detail: {
          gate: "production-ready",
          failures: [
            { nodeId: "HYP-001", reason: "Unverified claim requires empirical test receipt." },
          ],
        },
      });

      const output = formatJsonDiagnostic(error);
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        code: "GATE_FAILED",
        message: "Epistemic gate 'production-ready' failed verification.",
        detail: {
          gate: "production-ready",
          failures: [
            { nodeId: "HYP-001", reason: "Unverified claim requires empirical test receipt." },
          ],
        },
      });
    });

    it("serializes an array of errors as a JSON array", () => {
      const errors = [
        new AriadneError({ code: "GATE_FAILED", message: "First gate failed" }),
        new AriadneError({ code: "MERGE_DIVERGED", message: "Branch diverged" }),
      ];

      const output = formatJsonDiagnostic(errors);
      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].code).toBe("GATE_FAILED");
      expect(parsed[1].code).toBe("MERGE_DIVERGED");
    });
  });

  describe("formatDiagnostic", () => {
    it("returns exit code and human text by default", () => {
      const error = new AriadneError({
        code: "INVALID_INPUT",
        message: "Bad flag",
        repair: "Use --help",
      });

      const formatted = formatDiagnostic(error);
      expect(formatted.exitCode).toBe(2);
      expect(formatted.text).toBe("Error: [INVALID_INPUT] Bad flag\nRepair: Use --help\n");
    });

    it("returns exit code 1 and JSON array when json is true for exit 1 error", () => {
      const error = new AriadneError({
        code: "COMMAND_FAILED",
        message: "Verification command failed",
      });

      const formatted = formatDiagnostic(error, { json: true });
      expect(formatted.exitCode).toBe(1);
      const parsed = JSON.parse(formatted.text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].code).toBe("COMMAND_FAILED");
    });

    it("handles generic Error with exit code 2 and INVARIANT_VIOLATION in JSON mode", () => {
      const error = new Error("Unexpected crash");
      const formatted = formatDiagnostic(error, { json: true });
      expect(formatted.exitCode).toBe(2);
      const parsed = JSON.parse(formatted.text);
      expect(parsed).toEqual({
        code: "INVARIANT_VIOLATION",
        message: "Unexpected crash",
      });
    });
  });
});

describe("CLI Integration & Error Interception", () => {
  it("formats unknown command as human-readable error with exit code 2", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await runCli(["unknown-command-xyz"], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(2);
    expect(stdout.text()).toBe("");
    expect(stderr.text()).toBe("Error: [INVALID_INPUT] Unknown command: unknown-command-xyz\n");
  });

  it("formats unknown command as structured JSON when --json is provided", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await runCli(["unknown-command-xyz", "--json"], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(2);
    expect(stdout.text()).toBe("");
    const parsed = JSON.parse(stderr.text());
    expect(parsed).toEqual({
      code: "INVALID_INPUT",
      message: "Unknown command: unknown-command-xyz",
    });
  });

  it("formats unknown command as structured JSON when --format json is provided", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await runCli(["unknown-command-xyz", "--format", "json"], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(2);
    expect(stdout.text()).toBe("");
    const parsed = JSON.parse(stderr.text());
    expect(parsed).toEqual({
      code: "INVALID_INPUT",
      message: "Unknown command: unknown-command-xyz",
    });
  });

  it("formats unknown command as structured JSON when --format=json is provided", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await runCli(["unknown-command-xyz", "--format=json"], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(2);
    expect(stdout.text()).toBe("");
    const parsed = JSON.parse(stderr.text());
    expect(parsed).toEqual({
      code: "INVALID_INPUT",
      message: "Unknown command: unknown-command-xyz",
    });
  });

  it("returns exit class 2 for unexpected command-handler errors", async () => {
    const stdout = capture();
    const stderr = capture();

    const exitCode = await runCli(["gate", "not-a-gate"], {
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(2);
    expect(stdout.text()).toBe("");
    expect(stderr.text()).toBe("Error: [INVALID_INPUT] Unknown gate: not-a-gate\n");
  });
});

describe("Package Re-exports from src/index.ts", () => {
  it("re-exports AriadneError from src/index.ts", () => {
    expect(rootExports.AriadneError).toBe(AriadneError);
  });
});
