# 14 — CLI node management commands (ariadne node)

**What to build:** CLI subcommands `ariadne node add`, `ariadne node get`, `ariadne node list`, and `ariadne node remove` with schema validation and immediate graph persistence.

**Blocked by:** 13 — CLI entrypoint and status command (ariadne status)

**Status:** ready-for-agent

- [ ] `ariadne node add <type> <id> --title <title> --payload <json>` validates schema before persisting
- [ ] `ariadne node list [--type] [--provenance]` supports filtered querying
- [ ] `ariadne node get <id>` prints full node metadata and provenance
