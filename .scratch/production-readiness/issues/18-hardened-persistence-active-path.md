# 18 — Route All Mutations Through the Hardened Persistence Protocol

**What to build:**
Make the hardened persistence protocol the only active path for every library and CLI mutation. The end-to-end mutation flow must acquire one workspace lock, validate before writing, append durable framed events, atomically update projections, and release ownership safely. Legacy and mixed-format workspaces must be rejected for mutation with the canonical diagnostic model.

**Blocked by:** None

**Status:** resolved

- [x] Every public and CLI mutation uses the same root lock and journal protocol.
- [x] The durable commit point is reached only after the journal write is synchronized successfully.
- [x] Projection updates are staged and atomically replaced after the journal commit.
- [x] Lock ownership is verified on release, and an active or ambiguous owner is never stolen.
- [x] Legacy and mixed-format workspaces cannot be mutated through any entry point.
- [x] Integration tests prove that the old persistence paths are no longer active.
- [x] Failure outcomes and diagnostics match the approved persistence contract.

## Implementation / verification

Implemented canonical attempt persistence in `src/harness/attempt.ts`: loading and mutations now use the hardened framed journal under `.orchestration/attempts/`, with validation, idempotency, revision checks, canonical diagnostics, and legacy-workspace rejection. The no-kernel contract now explicitly approves only the lifecycle, framed-journal, and diagnostic seams while retaining the real kernel-separation guarantees.

Verification completed 2026-09-08:

- Focused persistence/no-kernel tests: 7 files, 72 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Full suite `npm test`: 76 files, 861 tests passed.
- Implement-skill code review against `d5a34d5`: Standards — no findings; Spec — no findings.
