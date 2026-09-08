# 08 — In-Repo Dogfood Migration and Golden Fixture Validation

**What to build:**
Verification of the migration engine against the repository's own active `.ariadne/` state (over 880 entities) and establishment of frozen legacy test fixtures. Executes `ariadne migrate` directly against the live `.ariadne/` directory, confirms 100% entity and event preservation, updates all derived projections, and commits the newly formatted V1 state to Git. Also establishes frozen legacy v0 golden fixtures in `test/fixtures/legacy-v0/` to serve as a permanent regression test suite for format evolution.

**Blocked by:** 07 — Persisted-Format Migration Engine

**Status:** resolved

- [x] Complete pre-migration backup of the repository's `.ariadne/` directory is captured and archived into `test/fixtures/legacy-v0/`.
- [x] `ariadne migrate --dry-run` is executed against `.ariadne/` and verified to report zero errors and match expected entity counts.
- [x] `ariadne migrate` is executed against the active `.ariadne/` directory, converting `GRAPH.jsonl`, `NOTICES.jsonl`, `STATE.yaml`, `INDEX.md`, and cards to V1 format.
- [x] Post-migration entity and edge count assertion proves zero lost nodes, edges, or metadata payloads.
- [x] Migrated V1 `.ariadne/` state is committed to Git.
- [x] Golden regression tests in `test/fixtures/legacy-v0/` verify round-trip migration and rollback against the frozen v0 test dataset.

## Implementation Details

1. **Frozen Legacy V0 Fixture Archive (`test/fixtures/legacy-v0/`)**:
   - Archived the repository's active legacy v0 state into `test/fixtures/legacy-v0/.ariadne/`, capturing `GRAPH.jsonl`, `NOTICES.jsonl`, `STATE.yaml`, `INDEX.md`, and 280 node cards under `cards/` (total 284 files).
   - Generated `test/fixtures/legacy-v0/manifest.json` describing the golden fixture, containing exact entity counts (280 nodes, 413 edges, 1 notice, 881 journal records) and SHA-256 digests with byte sizes for all 284 archived files.

2. **Migration Engine Enhancement (`src/graph/migration.ts`)**:
   - Updated `parseAndValidateLegacyGraph` and invariant verification in `migrateWorkspace` to evaluate materialized graph state using `applyEvents`, ensuring legacy journal updates and edge tombstones are properly preserved without synthetic node-count drift.
   - Added record-count invariant verification asserting `stagedGraphFrames.length === graphItems.length` to guarantee 100% journal frame preservation.

3. **In-Repo Dogfood Migration Execution**:
   - Executed `ariadne migrate --dry-run` against `.ariadne/`, verifying 0 errors, reporting 280 nodes, 413 edges, 1 notice, 881 records, and predicting target file sizes without disk mutation.
   - Executed `ariadne migrate` against `.ariadne/`, creating immutable backup at `.ariadne/backups/MIG-1788806410471-075d5387/`.
   - Verified that `.ariadne/GRAPH.jsonl` contains 881 valid V1 framed records (`schemaVersion: 1`, monotonic sequence 1..881, CRC32, SHA-256 payload digest), `NOTICES.jsonl` contains V1 framed records, `STATE.yaml` contains `schema_version: 1`, and `INDEX.md` and 280 cards in `cards/` are updated to V1.
   - Verified `.ariadne/backups/` is in `.gitignore`.
   - Verified 100% entity and edge count preservation (280 nodes, 413 edges, 1 notice, 881 journal events).
   - Verified `isLegacyWorkspace(".ariadne")` returns `false`.

4. **Golden Regression Test Suite (`tests/fixtures/legacy-v0.test.ts`)**:
   - Created test suite verifying golden fixture manifest integrity.
   - Tested isolated workspace migration and rollback on temp copies, asserting 100% entity preservation, frame validity (CRC32, SHA-256, schemaVersion 1, sequence order), and bit-for-bit SHA-256 restoration upon rollback.

5. **Git Commit**:
   - Committed migrated V1 `.ariadne` workspace state and `test/fixtures/legacy-v0/` golden fixture to git with message `chore: migrate in-repo .ariadne workspace to V1 format and add legacy-v0 fixtures`.

