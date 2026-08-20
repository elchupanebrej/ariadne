# 15 — CLI edge management commands (ariadne edge)

**What to build:** CLI subcommands `ariadne edge add`, `ariadne edge list`, and `ariadne edge remove` with source/target existence and relationship validation.

**Blocked by:** 14 — CLI node management commands (ariadne node)

**Status:** ready-for-agent

- [ ] `ariadne edge add <from_id> <relation> <to_id>` validates relationship validity and creates edge
- [ ] `ariadne edge list [--from] [--to] [--relation]` outputs matching directed relations
- [ ] Rejects edge creation if nodes do not exist or if relation introduces a cyclic derivation
