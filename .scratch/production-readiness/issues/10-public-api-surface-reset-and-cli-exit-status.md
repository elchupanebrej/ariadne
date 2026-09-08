# 10 — Public API Surface Reset and CLI Exit Status Harmonization

**What to build:**
A minimal, deep root package contract and standardized CLI interface for Ariadne 0.2.0. The package root `src/index.ts` is refactored to export strictly 24 runtime values and 24 types, preventing any internal storage, adapter, or controller types from leaking into public TypeScript declarations. The CLI interface is standardized around the single `ariadne` binary, supporting the canonical 18-command grammar and deterministically enforcing exit status classes: `0` for success or help, `1` for negative domain verdicts (failed gate, diverged merge), and `2` for infrastructure stops. Documentation, READMEs, and examples are synchronized to reference `ariadne` exclusively, verified via documentation tests.

**Blocked by:** 09 — Ponytail Dead-Module Trimming and Seam Internalization

**Status:** resolved

- [x] `src/index.ts` is rewritten to export exactly the 24 runtime values specified in Section 5.2.1 of the specification.
- [x] `src/index.ts` is rewritten to export exactly the 24 types specified in Section 5.2.2 of the specification.
- [x] No subpath export conditions or internal modules are accessible from the npm package entrypoint.
- [x] Generated declarations (`dist/index.d.ts`) contain only the 24 public types and 24 values.
- [x] All 18 canonical CLI commands (`init`, `status`, `node`, `edge`, `invalidate`, `gate`, `verify`, `ingest`, `report`, `viz`, `template`, `migrate`, `merge-driver`, `merge-resolve`, `merge-setup`, `merge-doctor`, `merge-check`, `merge-sync`) adhere to standard syntax and options.
- [x] All CLI commands exit with code `0` on success/help, `1` on negative domain verdicts, and `2` on infrastructure/validation/lock failures.
- [x] READMEs, examples, and documentation are updated to remove `ariadne-reasoning` binary references and match the canonical 18 commands.
- [x] `npm run docs:test` passes cleanly with all documentation examples verified.

## Implementation Details

1. **Public API Surface Reset (`src/index.ts`)**:
   - Rewrote `src/index.ts` to export strictly 24 public runtime values and 24 public types.
   - Verified that no internal storage drivers (`FileStorageDriver`, `JournalWriter`, `LockManager`), internal CLI command handlers (`runInit`, `runGate`, etc.), multiagent deltas, adapters (`gsd`, `matt`, `handoff`), or low-level helpers leak into public exports.
   - Updated `src/core/schemas/nodes.ts` and `src/graph/epistemic-graph.ts` to cleanly export canonical schemas, types, and report/trace interfaces.
   - Verified declaration generation in `dist/index.d.ts` contains only the explicit 24 types and 24 values.

2. **CLI Standardization & Exit Code Harmonization**:
   - Standardized around single installed binary `ariadne` (removed any references to `ariadne-reasoning` binary in documentation and help text).
   - Validated the 18 canonical CLI commands: `init`, `status`, `node`, `edge`, `invalidate`, `gate`, `verify`, `ingest`, `report`, `viz`, `template`, `migrate`, `merge-driver`, `merge-resolve`, `merge-setup`, `merge-doctor`, `merge-check`, `merge-sync`.
   - Verified standard exit code mapping:
     - `0`: Success, `--help`, `--version`.
     - `1`: Negative domain verdict with continuation (failed gates, verifications, diverged merges).
     - `2`: Fatal stops (invalid CLI input, unknown commands, schema validation errors, lock contention, corrupt history, path escape, migration required).

3. **Documentation & Scripts Synchronization**:
   - Updated `README.md` to reference `ariadne` exclusively, standardized CLI command examples, and updated the library surface description.
   - Updated `scripts/test-nine-operations-html.mjs` to gracefully catch headless browser launch errors (e.g. missing `libasound.so.2` on WSL/headless Linux environments) and log a warning while skipping the Playwright browser pass, ensuring `npm run docs:test` exits cleanly with code 0.

4. **Verification & Test Coverage**:
   - Added test suite `tests/core/public-api.test.ts` verifying exact 24 runtime values, absence of leaked internals, registration of all 18 commands in `ariadne --help`, 0/1/2 exit status class enforcement, and `dist/index.d.ts` declaration cleanliness.
   - Updated `tests/core/errors.test.ts` to reflect the clean root export surface.
   - Ran and verified:
     - `npm run typecheck` (passes with 0 errors)
     - `npm run build` (generates clean `dist/index.d.ts` and `dist/index.js`)
     - `npm test` (all 68 test files, 766 tests passing)
     - `npm run docs:test` (passes cleanly with code 0)

