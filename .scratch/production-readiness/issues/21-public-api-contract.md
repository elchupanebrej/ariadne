# 21 — Resolve and Enforce the Public API Contract

**What to build:**
Resolve the conflicting public-surface counts in the approved specification and tests, then make the package expose exactly one intentional runtime and type contract. Removed prototype capabilities must stay private, while the supported error, graph, validation, profile, and CLI-facing types remain coherent and versioned.

**Blocked by:** None

**Status:** resolved

- [x] One authoritative runtime export list and one authoritative type export list are recorded in the specification.
- [x] The implementation, declaration output, and export-surface tests agree with those lists.
- [x] The canonical error type and diagnostic payload are usable from the public API.
- [x] Prototype-only modules and accidental internal helpers are absent from the public package surface.
- [x] Public API compatibility behavior is documented for supported callers.
- [x] A clean consumer can import the supported API without source-tree or development-only dependencies.

## Answer

Issue 21 is resolved. The approved public contract is 24 runtime exports and 32 type-only exports. The root barrel now exposes the complete diagnostic, validation, profile, and CLI type vocabulary, while `EpistemicGraph` keeps storage construction and its driver private. Declaration parity, internal-export absence, package subpath rejection, and clean-consumer compatibility are enforced by focused tests and the packed-consumer fixture.

## Comments

- 2026-09-08 — Implementation / verification: `npm run typecheck`, `npm run build`, `npx vitest run tests/core/public-api.test.ts --testTimeout 15000` (11/11), `npm run pack:smoke` (npm, pnpm, and Yarn consumers), and the full `npm test` suite (76 files, 863 tests) passed. The implement-skill Standards and Spec review against `HEAD` reported no findings.
