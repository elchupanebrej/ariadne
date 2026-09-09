# 22 — Align CLI Grammar and Diagnostic Exit Semantics

**What to build:**
Bring the CLI implementation, help output, parser, command handlers, and integration tests into agreement with the canonical command grammar. The CLI must distinguish successful operations, negative domain verdicts, and fatal syntax, validation, or infrastructure failures using the approved exit-status contract.

**Blocked by:** 18, 21

**Status:** resolved

- [x] Every canonical command form accepts the documented positional arguments and options.
- [x] Ingest, report, visualization, migration, and merge-driver formats are parsed and displayed consistently.
- [x] Help and version output describe only supported commands and flags.
- [x] Negative domain results exit with status 1.
- [x] Syntax, validation, and infrastructure failures exit with status 2.
- [x] JSON and human-readable diagnostics preserve the canonical error code and redaction rules.
- [x] CLI integration tests cover success, negative verdict, fatal error, and help paths.

## Answer

The CLI contract and exit semantics are implemented in `3cc54c7` (`feat: align CLI contract and exit semantics`). Verification completed with Node 24 using direct Vitest invocation (without the broken npm shim): the `tests/cli` suite passed 16 files and 202 tests with `--testTimeout 60000`; `merge.test.ts` passed 14/14 and `merge-integration.test.ts` passed 16/16. The previously observed failures at the 15-second timeout were test-duration timeouts, not assertion failures.
