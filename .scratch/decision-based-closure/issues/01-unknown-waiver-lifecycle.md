# 01 — Unknown waiver lifecycle and CLI (`ariadne waive <UNK> --by <DEC>`)

**What to build:**
A CLI command `ariadne waive <UNK> --by <DEC>` that allows method users to close a Decision-Significant Unknown when an architectural decision makes it moot, without falsely asserting that empirical evidence was gathered. The operation updates the unknown's status to `WAIVED`, records a `waived_by` reference to the closing decision, renders an updated card file showing the waiver reference, and removes the node from the live frontier and open unknowns lists under the storage lock. It enforces strict guards: the target must be an unknown node, the closing node must be an existing live decision, self-reference is forbidden, repeat invocations with the same closer are idempotent, and conflicting closers are rejected with a clear error.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] Invoking `ariadne waive <UNK> --by <DEC>` sets the target node's status to `WAIVED` and sets its `waived_by` attribute to the closing decision's ID.
- [x] The command runs atomically under the storage lock and emits a node event to the append-only event log.
- [x] The target unknown is removed from the active frontier and open unknowns in storage state and status summaries.
- [x] The node's card file is updated with status `WAIVED` and reflects the `waived_by` reference.
- [x] Re-running the exact same waive command is idempotent and does not produce duplicate events in the event log.
- [x] Attempting to waive an unknown that is already waived by a different decision fails with a conflict error.
- [x] Attempting to waive a non-UNK node fails with a clear validation error.
- [x] Supplying a non-DEC or non-existent node for `--by` fails with a clear validation error.
- [x] Supplying a `SUPERSEDED` or `RE-OPENED` decision for `--by` fails with a liveness guard error.
- [x] Supplying the target unknown itself as the `--by` node fails with a self-reference guard error.
- [x] The command provides `--help` / `-h` usage documentation.
- [x] Behavior is verified end-to-end via CLI execution in isolated test workspaces.
