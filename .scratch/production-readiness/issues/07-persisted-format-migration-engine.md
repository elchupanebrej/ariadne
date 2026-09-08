# 07 — Persisted-Format Migration Engine

**What to build:**
The user-invoked `ariadne migrate` CLI command and underlying migration engine for upgrading legacy `.ariadne` workspaces to V1. Runs under mutual exclusion using the root lock, parses legacy v0 records, generates an immutable digest backup under `.ariadne/backups/<id>/`, produces successor V1 files in `.ariadne/staging/<id>/`, verifies entity counts and schema invariants, atomically swaps staged files to live, and supports interrupted migration resumption. Also delivers `--dry-run` to preview changes without disk mutation and `--rollback <id>` to restore verified snapshots.

**Blocked by:** 06 — Crash Recovery and Legacy Workspace Mutation Gate

**Status:** resolved

- [x] Legacy v0 schema parser and V1 framed serializer parse legacy naked JSON records into V1 framed, checksummed records without data loss.
- [x] Root lock is acquired prior to migration and held throughout backup, staging, and atomic swap.
- [x] Immutable backup snapshots with SHA-256 manifests are generated in `.ariadne/backups/<migration-id>/`, and `.ariadne/backups/` is ensured in `.gitignore`.
- [x] Successor V1 state is staged in `.ariadne/staging/<migration-id>/` and validated against V1 Zod schemas before commit.
- [x] Invariant verification checks that all node IDs, edge relationships, timestamps, and adapter overlay properties match source records 1:1.
- [x] Atomic directory swap replaces active workspace files with verified staging files.
- [x] `ariadne migrate --dry-run` performs validation and computes target digests and entity counts without writing changes to disk.
- [x] `ariadne migrate --rollback <migration-id>` safely restores a workspace from an immutable backup snapshot.
- [x] Crash simulation tests prove that mid-flight interrupted migrations resume safely or fail closed if source records were modified.

## Implementation Details

1. **Migration Engine (`src/graph/migration.ts`)**:
   - `migrateWorkspace(storageRoot: string, options?: MigrateOptions)`:
     - Under mutual exclusion via `withRootLock` (`.ariadne/.lock`), inspects legacy files (`GRAPH.jsonl`, `NOTICES.jsonl`, `STATE.yaml`, and cards).
     - Validates records against legacy schemas (`GraphEventSchema`, `NodeSchema`, `EdgeSchema`, `OperationalNoticeSchema`, `StateSchema`); detects mixed versions and rejects newer versions (`UNSUPPORTED_FORMAT`) or corrupted lines (`CORRUPT_PERSISTED_HISTORY`).
     - **Pre-flight dry-run (`--dry-run`)**: Computes entity counts, source digests, and predicted target record numbers and sizes without mutating disk.
     - **Immutable backup**: Creates `.ariadne/backups/<migration-id>/` with verbatim source file copies, verifies byte digests, writes `manifest.json` with status `"STAGED"`, and ensures `.ariadne/backups/` is in `.gitignore`.
     - **Staging area**: Synthesizes V1 successor files in `.ariadne/staging/<migration-id>/`. Serializes canonical events into V1 `FramedRecord` envelopes with monotonic sequence numbers, CRC32 checksums, SHA-256 payload digests, timestamps, and schemaVersion 1. Rebuilds `STATE.yaml` (preserving adapter overlay fields with `schema_version: 1`), `INDEX.md`, and all `cards/*.md`.
     - **Invariant verification**: Verifies 100% preservation of all node IDs, statements, types, provenance types, timestamps, edge relationships, and notices. Sets `manifest.json` status to `"COMPLETE"`.
     - **Atomic swap**: Atomically replaces active workspace files with staged successor files using `fs.promises.rename` (including directory rotation for `cards/`), cleans up `.ariadne/staging/<migration-id>/`, and retains the backup snapshot.
     - **Interruption recovery**: Detects interrupted staging directories from crashed runs. If live source files match the backup manifest digests, safely resumes; if source files were altered or missing, fails closed with `AriadneError(CORRUPT_PERSISTED_HISTORY)`.
   - `rollbackMigration(storageRoot: string, migrationId: string)`:
     - Under root lock, locates `.ariadne/backups/<migration-id>/`.
     - Verifies `manifest.json` and SHA-256 hashes of all backed-up files.
     - Atomically restores all files to the live workspace root and updates manifest status to `"ROLLED_BACK"`. Workspace is restored to its original legacy v0 format.

2. **CLI Command (`src/cli/commands/migrate.ts` and `src/cli/index.ts`)**:
   - Implemented `ariadne migrate [--dry-run] [--rollback <id>] [--json]`.
   - Formatted human-readable summary text and structured JSON (`--json`). Exits 0 on success.

3. **Module Exports (`src/graph/index.ts`)**:
   - Re-exported all migration functions and types (`migrateWorkspace`, `rollbackMigration`, `MigrateOptions`, `MigrationResult`, `RollbackResult`, `MigrationManifest`, `computeFileDigest`, `computeSha256`, etc.).

4. **Test Suite (`tests/graph/migration.test.ts`)**:
   - 15 comprehensive unit and integration tests covering dry-run non-mutation, full migration, 100% node/edge preservation, backup creation, `.gitignore` updates, rollback restoration, crash recovery resumption and tamper detection, corruption rejection, and CLI invocation.
