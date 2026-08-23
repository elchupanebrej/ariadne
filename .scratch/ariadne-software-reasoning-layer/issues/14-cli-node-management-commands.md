# 14 — CLI node management commands (ariadne node)

**What to build:** CLI subcommands `ariadne node add`, `ariadne node get`, `ariadne node list`, and `ariadne node remove` with schema validation and immediate graph persistence.

**Blocked by:** 13 — CLI entrypoint and status command (ariadne status)

**Status:** resolved

- [ ] `ariadne node add <type> <id> --title <title> --payload <json>` validates schema before persisting
- [ ] `ariadne node list [--type] [--provenance]` supports filtered querying
- [ ] `ariadne node get <id>` prints full node metadata and provenance

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: commands/node.ts add/list/get with schema validation before persisting; cli/node.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
