# 18 — CLI initialization and template scaffolding (ariadne init / template)

**What to build:** CLI commands `ariadne init [--mode]` to initialize `.ariadne/` and `ariadne template <type>` to scaffold markdown card templates for reasoning operations.

**Blocked by:** 05 — Atomic file storage manager, 13 — CLI entrypoint and status command (ariadne status)

**Status:** resolved

- [ ] `ariadne init` creates `.ariadne/` directory with valid `STATE.yaml`, `GRAPH.jsonl`, and `INDEX.md`
- [ ] `ariadne template <type>` outputs compliant Markdown templates (`FRAME-`, `DIAG-`, `LEAN-TASK-`, `TRANS-`)
- [ ] Refuses to overwrite existing initialized workspace without `--force`

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: commands/init.ts creates STATE.yaml/GRAPH.jsonl/INDEX.md with --force guard; template FRAME/DIAG/LEAN-TASK/TRANS; init-template tests. Full suite green (53 files / 557+ tests), typecheck clean.
