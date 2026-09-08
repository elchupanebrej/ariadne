# 01 — Unified Diagnostic Vocabulary and Error Model

**What to build:**
A unified operational diagnostic and error architecture for Ariadne. When any infrastructure, validation, containment, or storage fault occurs, the runtime throws an `AriadneError` carrying a screaming-snake `DiagnosticCode` drawn from an explicit 19-code catalog, user-actionable repair instructions, and structured context. The CLI intercepts these errors and formats them deterministically to `stderr`, mapping fatal infrastructure stops to exit status 2, domain verdicts with continuation to exit status 1, and emitting machine-readable structured JSON when requested via `--format json`.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] All 19 stable screaming-snake `DiagnosticCode` constants (`INVALID_INPUT`, `MISSING_DATA`, `CORRUPT_PERSISTED_HISTORY`, `INCOMPLETE_TAIL`, `UNSUPPORTED_FORMAT`, `MIGRATION_REQUIRED`, `LOCK_CONTENTION`, `LOCK_OWNERSHIP_UNCERTAIN`, `PERMISSION_DENIED`, `PATH_ESCAPE`, `INVARIANT_VIOLATION`, `IDEMPOTENCY_CONFLICT`, `COMMIT_UNKNOWN`, `TIMEOUT`, `CAPACITY_EXCEEDED`, `PROJECTION_RECOVERY_NEEDED`, `COMMAND_FAILED`, `GATE_FAILED`, `MERGE_DIVERGED`) are defined and exported.
- [x] Each diagnostic code is mapped deterministically to its exit status class (`0`, `1`, `2`) and repair tier (`mandatory`, `optional`, `none`).
- [x] Unified `AriadneError` class is implemented with `code`, `message`, `repair`, and `detail` properties.
- [x] Structured diagnostic formatter outputs single fatal JSON error objects for exit class 2 and arrays of domain diagnostics for exit class 1 to `stderr` when `--format json` is passed.
- [x] Default human-readable `stderr` formatter displays clear error messages with actionable repair guidance.
- [x] Unit tests verify code-to-exit-class mapping, structured JSON serialization, and error propagation across failure modes.

## Implementation Details

- Defined the 19 screaming-snake `DiagnosticCode` constants in `src/core/errors.ts` alongside mapping objects and helper functions: `EXIT_STATUS_BY_CODE`, `exitCodeFor`, `REPAIR_TIER_BY_CODE`, `repairTierFor`.
- Implemented `AriadneError` base class extending `Error` with `code`, `message`, optional `repair`, and optional `detail` record, with explicit prototype configuration and `isAriadneError` type guard.
- Implemented diagnostic formatters:
  - `formatHumanDiagnostic`: Formats clear human-readable error messages with `Error: [CODE] <message>` and optional actionable `Repair: <repair>` guidance.
  - `formatJsonDiagnostic`: Formats exit class 2 fatal errors as single JSON objects (omitting undefined properties) and exit class 1 domain verdicts as JSON arrays of diagnostic objects.
  - `formatDiagnostic`: Unified formatter returning `{ exitCode, text }`.
- Integrated error interception into `runCli` in `src/cli/index.ts`, handling `--json`, `--format json`, and `--format=json`, mapping unknown commands to `AriadneError(INVALID_INPUT)` with exit code 2.
- Re-exported all error classes, codes, types, mappings, and formatters in `src/index.ts`.
- Added a comprehensive unit test suite in `tests/core/errors.test.ts` with 21 tests covering all 19 diagnostic codes, exit status and repair tier mappings, serialization formats, prototype checks, and CLI interception.

