# 15 — CLI edge management commands (ariadne edge)

**What to build:** CLI subcommands `ariadne edge add`, `ariadne edge list`, and `ariadne edge remove` with source/target existence and relationship validation.

**Blocked by:** 14 — CLI node management commands (ariadne node)

**Status:** resolved

- [ ] `ariadne edge add <from_id> <relation> <to_id>` validates relationship validity and creates edge
- [ ] `ariadne edge list [--from] [--to] [--relation]` outputs matching directed relations
- [ ] Rejects edge creation if nodes do not exist or if relation introduces a cyclic derivation

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: commands/edge.ts add/list filters + validateGraph cycle rejection; cli/edge.test.ts. Canonical relation aliases added per ingress ticket 03. Full suite green (53 files / 557+ tests), typecheck clean.
