# 12 — Tarball Zero-Leakage Enforcement and Clean-Consumer Smokes

**What to build:**
Automated release packaging verification that guarantees zero source leakage and proves clean installation across supported package managers. Implements `scripts/pack-smoke.mjs` to validate that `npm pack` produces a tarball matching the strict allowlist (`dist/**`, `.agents/skills/{ariadne,codebase-design,grilling,domain-modeling}/**`, `README.md`, `LICENSE`, `package.json`), failing the build if any TypeScript source file, test file, configuration, or workflow is leaked. Executes clean-consumer smoke tests creating isolated test consumer projects that install the packed `.tgz` under npm (v10-12), pnpm (v10-12), and Yarn (v4 with `nodeLinker: node-modules`), asserting clean CLI execution and library import.

**Blocked by:** 11 — Package Manifest Realignment and Canonical Skill Bundling

**Status:** resolved

- [x] `scripts/pack-smoke.mjs` is implemented and wired to `npm run pack:smoke`.
- [x] Tarball contents validator enforces zero-leakage: packaging fails if any `src/**`, `test/**`, `tests/**`, `tsconfig*.json`, `vitest.config.ts`, `.github/**`, or `.scratch/**` file is present.
- [x] Tarball contents validator confirms the presence of required assets (`dist/**`, 4 canonical skills, `README.md`, `LICENSE`).
- [x] Clean-consumer installation smoke creates temporary consumer workspaces outside the repo.
- [x] Clean-consumer smoke verifies `npm install <tarball>`, running `npx ariadne --version` and executing a Node.js script that imports `ariadne-reasoning` and verifies types.
- [x] Multi-package-manager smoke verifies equivalent installation and execution behavior with `pnpm` and `yarn` (node-modules).

## Implementation Details

1. **Automated Release Packaging & Strict Tarball Validator (`scripts/pack-smoke.mjs`)**:
   - Executes `npm pack --pack-destination <tmpDir>` to generate candidate tarball `ariadne-reasoning-0.2.0.tgz`.
   - Inspects tarball contents using `tar -tzf` with path normalization.
   - Enforces the strict allowlist (`dist/**`, `.agents/skills/{ariadne,codebase-design,grilling,domain-modeling}/**`, `README.md`, `LICENSE`, `package.json`).
   - Enforces zero-leakage guarantee by rejecting any entries matching `src/**`, `tests/**`, `test/**`, `tsconfig*.json`, `vitest.config.ts`, `.github/**`, `.scratch/**`, `.planning/**`, `scripts/**`, or `.agents/skills/methodize-harness/**`.
   - Asserts the presence of all required release assets: `package.json`, `README.md`, `LICENSE`, `dist/index.js`, `dist/index.d.ts`, `dist/cli/index.js`, and `SKILL.md` + `example/check.mjs` across all 4 canonical skills.

2. **Clean Consumer Smoke (`npm`)**:
   - Creates an isolated consumer workspace in OS temporary directory outside the repository tree.
   - Runs `npm install <tarball>`.
   - Executes `npx ariadne --version` in the consumer workspace and asserts output matches `0.2.0` with exit code 0.
   - Executes a runtime Node.js ES module importing `{ EpistemicGraph, EpistemicGateEngine, AriadneError, runCli }` from `ariadne-reasoning` and validates runtime behavior.
   - Runs `example/check.mjs` for each bundled canonical skill directly from the consumer's installed `node_modules` directory and asserts success (`All verification checks passed!`).
   - Typechecks consumer imports with `tsc --noEmit` and strict compiler options.

3. **Multi-Package-Manager Smokes (`pnpm` & `yarn`)**:
   - Creates isolated consumer environments for `pnpm` and `yarn`.
   - `pnpm`: Installs candidate tarball via `pnpm add <tarball>` and verifies `npx ariadne --version` exits 0 with `0.2.0`.
   - `yarn`: Configures `.yarnrc.yml` (`nodeLinker: node-modules`) and installs candidate tarball via `yarn add <tarball> --ignore-engines`, verifying `npx ariadne --version` exits 0 with `0.2.0`.
   - Designed portably for Windows (`.cmd` extensions and recursive directory handling) and Unix platforms.

4. **CLI Version Synchronization & Automated Test Suite**:
   - Synchronized `VERSION = "0.2.0"` in `src/cli/index.ts` to match `package.json` release version `0.2.0`.
   - Added unit test suite in [`tests/pack/pack-smoke.test.ts`](../../tests/pack/pack-smoke.test.ts) verifying negative zero-leakage pattern matching, positive allowlist matching, and execution of `scripts/pack-smoke.mjs`.
   - Verified that `node scripts/pack-smoke.mjs`, `npm run pack:smoke`, `npm run typecheck`, and `npm test` all pass cleanly with 100% test success.
