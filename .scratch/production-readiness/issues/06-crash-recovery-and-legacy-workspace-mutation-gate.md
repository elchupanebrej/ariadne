# 06 — Crash Recovery and Legacy Workspace Mutation Gate

**What to build:**
Automated crash recovery, projection reconstruction, and legacy workspace protection. On initialization, Ariadne validates the canonical ledger `GRAPH.jsonl`: if a partial, torn write is detected at the tail of the file, it automatically truncates the log back to the last valid frame and emits `INCOMPLETE_TAIL`. Corrupted records prior to the final frame immediately fail closed with `AriadneError(CORRUPT_PERSISTED_HISTORY)`. Projections are validated and rebuilt from canonical authority whenever corrupted or missing. In addition, unversioned legacy (v0) workspaces are detected and immediately gated: read-only inspection (`ariadne status`, `ariadne report`) is permitted, but any mutating operation aborts fail-closed with `AriadneError(MIGRATION_REQUIRED)`.

**Blocked by:** 05 — Framed Canonical Journal and Atomic Write Cycle

**Status:** resolved

- [x] Startup integrity scan checks `GRAPH.jsonl` frame lengths and checksums.
- [x] Incomplete final frames (torn writes or truncated payloads) are safely truncated to the last verified frame offset with an audit warning and `INCOMPLETE_TAIL` diagnostic.
- [x] Middle-log corruption, invalid digests, or sequence gaps prior to the final record fail closed immediately with `AriadneError(CORRUPT_PERSISTED_HISTORY)`.
- [x] Projection repair engine regenerates `STATE.yaml`, `INDEX.md`, and all `cards/*.md` directly from valid canonical records.
- [x] Legacy v0 workspaces lacking format version metadata are detected upon opening.
- [x] Read-only operations (`ariadne status`, `ariadne report`, `ariadne viz`) allow inspection of legacy workspaces.
- [x] Mutating CLI operations (`ariadne node`, `ariadne edge`, `ariadne invalidate`, `ariadne gate`) immediately abort without modifying files, throwing `AriadneError(MIGRATION_REQUIRED)`.
- [x] Tests simulate power halts/process kills during append and staging, verifying automatic tail truncation, fail-closed corruption handling, and legacy mutation gating.

## Implementation Details

1. **Startup Integrity Scan & Tail Recovery (`src/graph/recovery.ts`)**:
   - Implemented `scanAndRecoverJournal(journalPath: string): Promise<JournalScanResult>`:
     - Parses each line in canonical journals (`GRAPH.jsonl`, `NOTICES.jsonl`) and validates frame structure against `FramedRecord` specification (`schemaVersion: 1`, sequence monotonicity, `payloadLength`, CRC32, SHA-256 `payloadDigest`).
     - **Incomplete Final Frame**: If the last record in the journal is incomplete, truncated, or has mismatched frame length/CRC, safely truncates the file back to the last verified frame offset via `fs.promises.truncate(journalPath, lastValidOffset)` and returns `{ recoveredTail: true, truncatedBytes, diagnostic: { code: "INCOMPLETE_TAIL", ... } }`.
     - **Middle-Log Corruption**: Any corruption, checksum mismatch, schema invalidity, or sequence break occurring prior to the final frame immediately fails closed without truncating, throwing `new AriadneError({ code: "CORRUPT_PERSISTED_HISTORY", message: "Middle corruption or checksum mismatch detected in canonical history", repair: "Inspect .ariadne/GRAPH.jsonl or restore from backup." })`.
   - Implemented `rebuildProjections(storageRoot: string): Promise<void>`:
     - Reads canonical records from `GRAPH.jsonl` under root lock via `withRootLock`.
     - Materializes graph state using `applyEvents`.
     - Atomically regenerates and swaps `STATE.yaml`, `INDEX.md`, and all node cards (`cards/*.md`) using temporary sibling staging files (`.tmp.<file>.<pid>.<uuid>`) and atomic `rename`.
     - Cleans up orphaned cards not present in the materialized graph.

2. **Legacy Workspace Protection Gate (`src/graph/legacy.ts`)**:
   - Implemented `isLegacyWorkspace(storageRoot: string): Promise<boolean>`:
     - Detects workspaces containing legacy v0 structures lacking format version metadata (e.g. `GRAPH.jsonl` or `NOTICES.jsonl` with unversioned or naked JSON records lacking `schemaVersion: 1`).
     - Fresh or non-existent storage roots return `false`.
   - Implemented `assertNotLegacyWorkspace(storageRoot: string): Promise<void>`:
     - Fails closed throwing `new AriadneError({ code: "MIGRATION_REQUIRED", message: "Legacy (v0) workspace detected; mutation prohibited until migration.", repair: "Run 'ariadne migrate' to upgrade the workspace format." })`.
   - Storage write cycle integration: `executeWriteCycle` in `src/graph/journal.ts` guards all writes against legacy workspaces.

3. **CLI Integration**:
   - Read-only inspection operations (`ariadne status`, `ariadne report`, `ariadne viz`) allow inspecting legacy v0 workspaces without error or mutation.
   - Mutating CLI operations (`ariadne node`, `ariadne edge`, `ariadne invalidate`, `ariadne gate`) gate before modifying any files, throwing `AriadneError(MIGRATION_REQUIRED)` and exiting with code 2.

4. **Public Exports (`src/graph/index.ts`)**:
   - Re-exported `recovery.js` and `legacy.js`.

5. **Test Suite (`tests/graph/crash-recovery.test.ts`)**:
   - Verified clean startup on valid journal.
   - Verified automatic tail truncation and `INCOMPLETE_TAIL` emission on torn/incomplete final frames (both unclosed JSON and corrupt frames with newline).
   - Verified fail-closed behavior on middle-log corruption and sequence breaks with zero file truncation.
   - Verified faithful projection rebuild (`STATE.yaml`, `INDEX.md`, `cards/*.md`, and orphaned card cleanup).
   - Verified legacy workspace detection and fail-closed CLI gating on mutating commands (`node`, `edge`, `invalidate`, `gate`) with exit code 2 and unmutated files.
