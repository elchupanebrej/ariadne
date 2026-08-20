# 29 — Git worktree isolation for Deep Mode

**What to build:** Worktree manager that instantiates isolated Git worktrees for competing candidate mechanisms (`can-01-raft`, `can-02-crdt`) under Deep Mode so they can be evaluated against shared invariant test suites.

**Blocked by:** 05 — Atomic file storage manager, 13 — CLI entrypoint and status command (ariadne status)

**Status:** ready-for-agent

- [ ] Creates and cleans up isolated Git worktrees tied to candidate mechanism IDs
- [ ] Executes candidate builds/tests independently without workspace pollution
- [ ] Captures execution logs and generates corresponding `EVD-` evidence records
