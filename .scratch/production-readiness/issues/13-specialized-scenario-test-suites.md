# 13 — Specialized Scenario Test Suites

**What to build:**
Three isolated, rigorous scenario test suites in `tests/scenarios/` (or `test/scenarios/`) executing real multi-step workflows against actual filesystems in dedicated temporary directories. Suite 1 (Persistence & Crash Recovery) verifies two-process lock contention, PID-absent fast-path vs PID-alive 60s timeout, tail truncation on killed processes, fail-closed `CORRUPT_PERSISTED_HISTORY` on middle corruption, and full projection reconstruction. Suite 2 (Persisted-Format Migration) verifies legacy v0 fixtures, dry-run predictions, backup verification, crash resilience at checkpoints, and rejection of unsupported newer versions. Suite 3 (Security & Containment) verifies path escapes, external symlink rejections, direct execution bounding, and secret sanitization.

**Blocked by:**
- 03 — Direct Command Execution and Secret Redaction
- 10 — Public API Surface Reset and CLI Exit Status Harmonization

**Status:** resolved

- [x] Every scenario test runs within a unique isolated temporary directory with guaranteed cleanup on completion.
- [x] Persistence & Crash Recovery Suite tests:
  - Multi-process lock contention and atomic `.ariadne/.lock` acquisition.
  - PID-absent fast-path recovery vs PID-alive timeout with `AriadneError(LOCK_OWNERSHIP_UNCERTAIN)`.
  - Process kill during journal append, proving automatic tail truncation and `INCOMPLETE_TAIL` diagnostic.
  - Intentionally introduced bit corruption before final record, asserting fail-closed `AriadneError(CORRUPT_PERSISTED_HISTORY)`.
  - Projection rebuild verifying `STATE.yaml`, `INDEX.md`, and cards match reconstructed canonical state.
- [x] Persisted-Format Migration Suite tests:
  - Full migration of frozen legacy v0 fixture files with exact entity parity.
  - Pre-flight dry run digest and entity count validation without disk modifications.
  - Backup snapshot verification and verified rollback (`--rollback`).
  - Crash simulation at staging and atomic swap checkpoints confirming safe resumption.
  - Detection and rejection of future/unsupported format versions (`UNSUPPORTED_FORMAT`).
- [x] Security & Containment Suite tests:
  - Rejection of directory traversal escapes (`../../`) with `AriadneError(PATH_ESCAPE)`.
  - Rejection of external symlinks resolving outside the storage root with `AriadneError(PATH_ESCAPE)`.
  - Detection of non-regular files (FIFOs) with `AriadneError(INVALID_INPUT)`.
  - Process execution timeout termination and 1 MB output truncation.
  - Secret redaction ensuring tokens in command output are scrubbed from diagnostic details.

## Implementation Details
Implemented three specialized scenario test suites under `tests/scenarios/` covering the full breadth of persistence, crash recovery, migration, and security containment boundaries:

1. `tests/scenarios/persistence-crash-recovery.test.ts`:
   - Validates multi-process lock contention using concurrent async workers and spawned external Node processes contending for `.ariadne/.lock` with backoff retries.
   - Tests PID-absent fast-path recovery when processes crash or are killed (`SIGKILL`), reaping abandoned lock directories immediately without timeout delay.
   - Verifies PID-alive fail-closed behavior with `AriadneError(LOCK_OWNERSHIP_UNCERTAIN)` when lock is held by a living PID across the timeout window, preserving owner records without stealing.
   - Verifies torn write recovery at EOF: truncating incomplete/torn frames back to the last verified byte boundary and emitting structured `INCOMPLETE_TAIL` diagnostics.
   - Asserts strict fail-closed behavior on middle-log corruption (tampered checksums, invalid JSON, sequence gaps) with `AriadneError(CORRUPT_PERSISTED_HISTORY)`, guaranteeing that automatic truncation is forbidden for committed historical records.
   - Tests canonical projection rebuild regenerating `STATE.yaml`, `INDEX.md`, and `cards/*.md` directly from `GRAPH.jsonl`, cleaning up orphaned cards and preserving adapter overlay attributes.

2. `tests/scenarios/format-migration.test.ts`:
   - Validates live migration of frozen legacy v0 fixture (`test/fixtures/legacy-v0/.ariadne`) with 100% entity and event fidelity (280 nodes, 413 edges, 1 notice, 881 graph records, 280 cards).
   - Verifies pre-flight `--dry-run` predictions and entity counts with zero disk mutations.
   - Validates immutable backup creation (`.ariadne/backups/<migrationId>/manifest.json`) and verified rollback (`--rollback`), returning all files to exact legacy v0 state with byte-for-byte SHA-256 match.
   - Tests crash simulation at staging and checkpoint recovery: safe resumption on matching digests and fail-closed abort with `AriadneError(CORRUPT_PERSISTED_HISTORY)` when live source was altered or deleted.
   - Rejects future/unsupported schema versions in `GRAPH.jsonl` or `NOTICES.jsonl` with `AriadneError(UNSUPPORTED_FORMAT)`.

3. `tests/scenarios/security-containment.test.ts`:
   - Verifies storage root containment boundary, rejecting `../../` traversal escapes and prefix-sharing sibling directories with `AriadneError(PATH_ESCAPE)`.
   - Rejects external directory and file symlinks escaping storage root as well as symlink loops with `AriadneError(PATH_ESCAPE)`, while permitting internal symlinks.
   - Rejects non-regular special files (FIFOs, UNIX domain sockets, character devices) with `AriadneError(INVALID_INPUT)`.
   - Restricts `--force` flag strictly to managed projection targets (`STATE.yaml`, `INDEX.md`, `cards/*.md`), failing closed on canonical authorities or external source code.
   - Verifies direct execution guardrails without shell interpolation (`shell: false`), timeout termination with `SIGTERM`/`SIGKILL` escalation throwing `AriadneError(TIMEOUT)`, and combined 1 MB output truncation with `TRUNCATION_WARNING_BANNER`.
   - Tests secret redaction across Bearer, JWT, SSH private keys, AWS access/secret keys, GitHub tokens, and sensitive credential assignments in command outputs and diagnostic detail payloads.

