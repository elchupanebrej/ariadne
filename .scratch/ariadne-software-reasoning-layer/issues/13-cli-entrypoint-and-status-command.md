# 13 — CLI entrypoint and status command (ariadne status)

**What to build:** Core CLI binary setup and `ariadne status` command displaying the active depth mode, epistemic frontier, open unknowns, and graph health in both human-readable and `--json` formats.

**Blocked by:** 05 — Atomic file storage manager, 06 — Compact index markdown generator

**Status:** ready-for-agent

- [ ] `ariadne --help` and `--version` output formatted CLI metadata
- [ ] `ariadne status` displays current frontier, depth mode, and open unknowns
- [ ] `ariadne status --json` outputs parseable structured JSON conforming to Spec v5
