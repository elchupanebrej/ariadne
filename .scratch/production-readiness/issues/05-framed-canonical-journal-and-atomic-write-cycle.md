# 05 — Framed Canonical Journal and Atomic Write Cycle

**What to build:**
A crash-resilient canonical persistence engine and atomic write cycle. Every mutation operation acquires the root lock, validates schemas, formats graph updates as length-prefixed and CRC32/SHA-256 digested frames, appends them to `GRAPH.jsonl`, and issues `FileHandle.sync()` to physical disk to establish an irrevocable commit point. Staged projections (`STATE.yaml`, `INDEX.md`, cards) are generated in temporary sibling files and atomically swapped via `fs.rename()`. Writes to orchestration attempt ledgers are partitioned into dedicated pointer-only logs under `.orchestration/attempts/<id>.jsonl`. Persistence calls return explicit 4-discriminant outcomes (`not_committed`, `commit_unknown`, `committed`, `committed_with_recovery_needed`).

**Blocked by:** 04 — Process Mutual Exclusion and Root Locking Protocol

**Status:** resolved

- [x] Framed journal writer serializes mutation records with explicit length prefixes, schema versions, idempotency keys, and CRC32/SHA-256 payload digests in `GRAPH.jsonl`.
- [x] Explicit commit point is established by awaiting `FileHandle.sync()` after appending to canonical authorities (`GRAPH.jsonl` and `NOTICES.jsonl`).
- [x] Derived projections (`STATE.yaml`, `INDEX.md`, `cards/*.md`) are staged in temporary sibling files (`.tmp.<file>.<pid>`) and replaced atomically using `fs.rename()`.
- [x] Dedicated pointer-only event ledgers under `.orchestration/attempts/<id>.jsonl` track orchestration lifecycles without mixing attempt records into the domain graph.
- [x] Persistence operations return a discriminated union of four explicit outcomes: `not_committed`, `commit_unknown`, `committed`, and `committed_with_recovery_needed`.
- [x] Reused idempotency keys with differing payload digests are rejected with `AriadneError(IDEMPOTENCY_CONFLICT)`.
- [x] Unit and I/O tests verify write framing, disk synchronization, atomic projection swap, and outcome discrimination.

## Implementation Details

Implemented `src/graph/journal.ts` and integrated with `src/graph/index.ts` and `src/graph/storage.ts`:
1. **Framed Journal Envelope**:
   - `FramedRecord<T>` interface and `FramedRecordSchema` (Zod) enforcing `schemaVersion: 1`, monotonic sequence counters, ISO-8601 timestamps, explicit `payloadLength` in UTF-8 bytes, `crc32` checksum (via `node:zlib`), and SHA-256 `payloadDigest` hex strings.
   - `createFramedRecord` / `createFrame` encoders with JSON serializability validation and `AriadneError(INVALID_INPUT)` error translation.
   - `verifyFrame` and `parseFramedRecord` / `parseFrame` with fail-closed validation throwing `AriadneError(CORRUPT_PERSISTED_HISTORY)`.
2. **Explicit Commit Point via `FileHandle.sync()`**:
   - Implemented `appendCanonicalRecord` and `appendCanonicalRecords` using `fs.promises.open(path, "a")`, writing framed record lines, and awaiting `handle.sync()` before closing.
3. **Idempotency Key Handling**:
   - Reused idempotency keys with matching payload digests return the existing committed outcome as a clean no-op without re-appending.
   - Reused idempotency keys with differing digests fail closed immediately, throwing `AriadneError(IDEMPOTENCY_CONFLICT)`.
4. **Derived Projections Atomic Swap**:
   - Implemented `stageAndSwapProjection` and `stageAndSwapProjections` creating sibling temporary files (`.tmp.<file>.<pid>.<uuid>`) and atomically swapping them via `fs.promises.rename()`.
   - Temporary files are unlinked if staging or renaming fails.
5. **Dedicated Orchestration Attempt Ledgers**:
   - Implemented `appendAttemptEvent`, `readAttemptEvents`, and `getAttemptLedgerPath` writing pointer-only framed logs to `.orchestration/attempts/<id>.jsonl`, completely isolated from domain graph records.
   - Directory traversal attempts in attempt IDs are rejected with `AriadneError(INVALID_INPUT)` or `AriadneError(PATH_ESCAPE)`.
6. **Explicit 4-Discriminant Persistence Outcomes**:
   - Implemented `executeWriteCycle` returning `PersistenceOutcome<T>`:
     - `committed`: Canonical append, physical sync, and projection updates all succeeded.
     - `committed_with_recovery_needed`: Canonical append synced (`FileHandle.sync()` succeeded), but projection staging or atomic swap failed.
     - `not_committed`: Aborted prior to canonical append (pre-validation failure, lock contention, schema mismatch).
     - `commit_unknown`: Failure occurred during canonical append or physical disk sync.
7. **JournalWriter Engine & Seam Integration**:
   - Implemented `JournalWriter` class exposing high-level operations across `GRAPH.jsonl`, `NOTICES.jsonl`, and attempt ledgers.
   - Exported all types and helpers from `src/graph/index.ts`.
   - Updated `GraphStorage.readEventsUnlocked` in `src/graph/storage.ts` to seamlessly unpack framed record payloads.
8. **Verification**:
   - Unit and integration tests in `tests/graph/journal.test.ts` (21 tests) covering framing, hashing, disk synchronization, idempotency conflict rejection, projection swaps, attempt ledgers, and all 4 persistence outcomes.
   - All tests pass, typecheck is clean (`tsc --noEmit`), and build succeeds (`tsc -p tsconfig.build.json`).
