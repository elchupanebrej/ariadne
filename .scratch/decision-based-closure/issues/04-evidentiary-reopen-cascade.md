# 04 — Evidentiary re-open cascade for waived and superseded nodes

**What to build:**
An evidentiary re-open hook integrated into the falsification cascade. When empirical evidence falsifies an assumption or hypothesis upstream of a decision causing that decision to transition to `RE-OPENED`, the cascade automatically queries all nodes whose `waived_by` or `superseded_by` pointer references that decision and transitions them to `RE-OPENED` status in the same atomic transaction. Routine supersession by a still-live decision does not trigger any re-open cascade; only empirical falsification unwinds the chain.

**Blocked by:** 01 — Unknown waiver lifecycle and CLI (`ariadne waive <UNK> --by <DEC>`), 02 — Decision supersession lifecycle and CLI (`ariadne supersede <DEC> --by <DEC>`), 03 — Invalidation routing diagnostics and CLI `--by` flag unification

**Status:** resolved

- [x] When a falsification cascade marks a decision `RE-OPENED`, all unknowns with `waived_by` matching that decision are updated to `RE-OPENED` status in the same transaction.
- [x] When a falsification cascade marks a decision `RE-OPENED`, all decisions with `superseded_by` matching that decision are updated to `RE-OPENED` status in the same transaction.
- [x] Evidentiary re-opens are reflected in the invalidation receipt and trace returned by the CLI.
- [x] Re-opened nodes return to the active frontier and open unknowns lists.
- [x] Superseding a decision with a live decision does NOT unwind or re-open any previously closed nodes.
- [x] Card files and index for all re-opened nodes are updated atomically under the storage lock.
- [x] Behavior is verified end-to-end via CLI in an isolated workspace (waive an UNK and supersede a DEC by DEC-1, then invalidate an ASM backing DEC-1 and verify both nodes return as `RE-OPENED`).
