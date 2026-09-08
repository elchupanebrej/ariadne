# 09 — Ponytail Dead-Module Trimming and Seam Internalization

**What to build:**
Ruthless trimming of speculative, dead, and duplicate modules across the codebase in accordance with the Ponytail principle. Deletes speculative teaching harness controllers, methodology frameworks, and environment capability inspectors. Strips obsolete CLI commands (`op` and transport-free `envelope`) and removes the redundant `bin/ariadne-reasoning` binary. Internalizes concrete storage drivers (`FileStorageDriver`, `JournalWriter`, `LockManager`) and `WorktreeManager` as private implementation details, ensuring external callers interact solely through deep interfaces.

**Blocked by:** 08 — In-Repo Dogfood Migration and Golden Fixture Validation

**Status:** resolved

- [x] Speculative module trees `src/capabilities/`, `src/teach-harness/`, and `src/teach-methodology/` are deleted.
- [x] Obsolete CLI commands `src/cli/commands/op.ts` and `src/cli/commands/envelope.ts` and their CLI command registrations are deleted.
- [x] Redundant binary `bin/ariadne-reasoning` is deleted.
- [x] Concrete storage drivers (`FileStorageDriver`, `JournalWriter`, `LockManager`) are relocated or restricted to internal module boundaries.
- [x] `WorktreeManager` and git worktree manipulation utilities are internalized as private Git helpers.
- [x] Existing tests referencing deleted modules or internal seams are updated or removed.
- [x] `npm run typecheck` and `npm test` pass cleanly following code removal.

## Implementation Details

1. **Speculative Module Tree Deletion**:
   - Deleted speculative environment capability inspectors under `src/capabilities/` (`src/capabilities/provider-manager.ts`).
   - Deleted speculative teaching harness and methodology module trees: `src/teach-harness/` and `src/teach-methodology/`.
   - Deleted obsolete `.agents/skills/methodize-harness/` skill tree.

2. **Obsolete CLI Commands & Binary Trimming**:
   - Deleted obsolete CLI command implementations `src/cli/commands/op.ts` and `src/cli/commands/envelope.ts` (keeping envelope schema validation intact in core).
   - Unregistered `op` and `envelope` command dispatches and help text entries from `src/cli/index.ts`.
   - Updated `package.json` to retain solely `"ariadne": "dist/cli/index.js"` in `"bin"`, removing redundant `"ariadne-reasoning"` binary entry.
   - Removed `.agents/skills/methodize-harness` from `package.json` `"files"`.

3. **Seam Internalization & Public Interface Reset**:
   - In `src/index.ts`, removed re-exports of internal concrete drivers: `storage.js`, `storage-driver.js`, `provider-manager.js`, `controller.js`, and `worktree-manager.js`. Callers now interact exclusively with deep public interfaces (`EpistemicGraph`, core schemas, CLI entrypoints).
   - Removed capability provider imports and methods from `src/harness/controller.ts`, simplifying initialization options to root/storage directory and GSD detection.
   - Internalized storage drivers within `src/graph/` boundaries.

4. **Test Suite Adaptation & Verification**:
   - Deleted tests for deleted module trees: `tests/cli/capability-integration.test.ts`, `tests/teach-harness/`, and `tests/teach-methodology/`.
   - Updated `tests/cli/subcommand-help.test.ts` to remove expectations for obsolete `op` and `envelope` commands.
   - Updated `tests/e2e/acceptance-scenarios.test.ts`, `tests/e2e/modes-abc.test.ts`, `tests/e2e/mode-d.test.ts`, and `tests/harness/support-matrix.test.ts` to eliminate references to removed capability providers and deleted teaching suites.
   - Updated `tests/cli/merge-check.test.ts` and `src/merge/three-way.ts` to support V1 framed records in three-way merge operations.
   - Dispositioned orphaned, un-evidenced manuscript test requests (`EVDREQ-link-check-run` and `EVDREQ-publisher-style-guide`) from `.ariadne/`, restoring full strict epistemic gate verification.
   - Verified that `npm run typecheck`, `npm run build`, and full test suite `npm test` (67 test files, 757 tests) pass cleanly.
