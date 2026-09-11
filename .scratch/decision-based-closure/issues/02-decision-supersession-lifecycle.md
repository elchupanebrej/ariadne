# 02 — Decision supersession lifecycle and CLI (`ariadne supersede <DEC> --by <DEC>`)

**What to build:**
A CLI command `ariadne supersede <DEC> --by <DEC>` that allows method users to replace an earlier decision with a later decision settling the same question. In a single atomic transaction under the storage lock, the old decision's status becomes `SUPERSEDED` with a `superseded_by` reference pointing to the new decision, a directed `supersedes` edge from the new decision to the old decision is created, and reverse-topology neighbors of the replaced decision are marked `NEEDS_REVIEW` to flag downstream dependents for review. Strict guards ensure that both targets are decisions, both exist, the closing decision is live, self-reference is rejected, and when both decisions declare a `decision_scope`, mismatched scopes are rejected.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Invoking `ariadne supersede <old-DEC> --by <new-DEC>` marks `<old-DEC>` with status `SUPERSEDED` and sets its `superseded_by` attribute to `<new-DEC>`.
- [x] In the same atomic transaction, a `supersedes` edge from `<new-DEC>` to `<old-DEC>` is recorded in the append-only event log.
- [x] Reverse-topology neighbors dependent on `<old-DEC>` are updated to status `NEEDS_REVIEW` without generating a `FALSIFIED` root or an Operational Notice.
- [x] The superseded decision is treated as terminal and removed from the active frontier.
- [x] Re-running the exact same supersession command is idempotent (no duplicate events or edges).
- [x] Attempting to supersede a decision that is already superseded by a different decision fails with a conflict error.
- [x] Attempting to supersede a non-DEC target or specifying a non-DEC `--by` node fails with a validation error.
- [x] Attempting to specify a nonexistent target or nonexistent `--by` decision fails with an error.
- [x] Self-reference (a decision superseding itself) is rejected.
- [x] Supplying a `SUPERSEDED` or `RE-OPENED` decision as the `--by` node fails with a liveness guard error.
- [x] When both decisions declare a `decision_scope`, mismatched scopes are rejected; if either or both omit `decision_scope`, supersession proceeds.
- [x] Card files and index entries are updated under storage lock.
- [x] The command provides `--help` / `-h` usage documentation.
- [x] Behavior is verified end-to-end via CLI execution in isolated test workspaces.
