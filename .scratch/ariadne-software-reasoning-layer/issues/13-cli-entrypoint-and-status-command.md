# 13 — CLI entrypoint and status command (ariadne status)

**What to build:** Core CLI binary setup and `ariadne status` command displaying the active depth mode, epistemic frontier, open unknowns, and graph health in both human-readable and `--json` formats.

**Blocked by:** 05 — Atomic file storage manager, 06 — Compact index markdown generator

**Status:** resolved

- [ ] `ariadne --help` and `--version` output formatted CLI metadata
- [ ] `ariadne status` displays current frontier, depth mode, and open unknowns
- [ ] `ariadne status --json` outputs parseable structured JSON conforming to Spec v5

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: cli/index.ts --help/--version; commands/status.ts frontier/depth/unknowns with --json; cli/status.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
