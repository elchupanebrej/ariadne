# 22 — Align CLI Grammar and Diagnostic Exit Semantics

**What to build:**
Bring the CLI implementation, help output, parser, command handlers, and integration tests into agreement with the canonical command grammar. The CLI must distinguish successful operations, negative domain verdicts, and fatal syntax, validation, or infrastructure failures using the approved exit-status contract.

**Blocked by:** 18, 21

**Status:** claimed

- [ ] Every canonical command form accepts the documented positional arguments and options.
- [ ] Ingest, report, visualization, migration, and merge-driver formats are parsed and displayed consistently.
- [ ] Help and version output describe only supported commands and flags.
- [ ] Negative domain results exit with status 1.
- [ ] Syntax, validation, and infrastructure failures exit with status 2.
- [ ] JSON and human-readable diagnostics preserve the canonical error code and redaction rules.
- [ ] CLI integration tests cover success, negative verdict, fatal error, and help paths.
