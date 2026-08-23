# 29 — Git worktree isolation for Deep Mode

**What to build:** Worktree manager that instantiates isolated Git worktrees for competing candidate mechanisms (`can-01-raft`, `can-02-crdt`) under Deep Mode so they can be evaluated against shared invariant test suites.

**Blocked by:** 05 — Atomic file storage manager, 13 — CLI entrypoint and status command (ariadne status)

**Status:** resolved

- [ ] Creates and cleans up isolated Git worktrees tied to candidate mechanism IDs
- [ ] Executes candidate builds/tests independently without workspace pollution
- [ ] Captures execution logs and generates corresponding `EVD-` evidence records

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: multiagent/worktree-manager.ts create/cleanup keyed to CAN-* ids, no-shell exec in isolated cwd, stdout/stderr digest -> EVD MEASURED nodes; worktree tests. Full suite green (53 files / 557+ tests), typecheck clean.
