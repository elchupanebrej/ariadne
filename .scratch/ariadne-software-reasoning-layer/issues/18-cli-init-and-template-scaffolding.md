# 18 — CLI initialization and template scaffolding (ariadne init / template)

**What to build:** CLI commands `ariadne init [--mode]` to initialize `.ariadne/` and `ariadne template <type>` to scaffold markdown card templates for reasoning operations.

**Blocked by:** 05 — Atomic file storage manager, 13 — CLI entrypoint and status command (ariadne status)

**Status:** ready-for-agent

- [ ] `ariadne init` creates `.ariadne/` directory with valid `STATE.yaml`, `GRAPH.jsonl`, and `INDEX.md`
- [ ] `ariadne template <type>` outputs compliant Markdown templates (`FRAME-`, `DIAG-`, `LEAN-TASK-`, `TRANS-`)
- [ ] Refuses to overwrite existing initialized workspace without `--force`
