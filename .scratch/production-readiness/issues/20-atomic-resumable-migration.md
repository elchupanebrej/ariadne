# 20 — Make Legacy Migration Atomic, Resumable, and Path-Contained

**What to build:**
Make legacy workspace migration a safe end-to-end transition from discovery through validation, backup, swap, interruption recovery, and rollback. Manifest entries and recovery markers must remain contained within the canonical workspace and must never permit arbitrary filesystem access.

**Blocked by:** 18, 19

**Status:** ready-for-agent

- [ ] Migration validates every source, staging, backup, and target path against the canonical workspace containment policy.
- [ ] Manifest tampering, traversal segments, symlinks, and non-regular files are rejected before mutation.
- [ ] The live workspace never exposes a mixed set of old and new authorities after an interrupted swap.
- [ ] An interrupted migration can resume or roll back deterministically from its durable marker.
- [ ] Rollback is atomic, containment-checked, and safe when the manifest or backup is damaged.
- [ ] Successful migration preserves all supported legacy data and produces a workspace accepted by normal recovery.
- [ ] Migration, interruption, rollback, and zero-loss scenarios are covered by tests.

## Comments

- 2026-09-08 — Finalization verification remains blocked. The focused migration suite passes (23/23), typecheck passes, and the production build passes. The full Vitest suite fails 3 of 874 tests (871 passed): `tests/fixtures/legacy-v0.test.ts` times out at the 15-second test limit; `tests/scenarios/format-migration.test.ts` cannot resume a staged manifest because the backup manifest lists `GRAPH.jsonl` without a backed-up file; and its deleted-source case receives the preflight missing-path diagnostic instead of the expected interrupted-source diagnostic. Code review also found that `executeMigrationSwap` and `executeRollback` rename or restore authorities one file at a time, so an interruption at `STATE.yaml` exposes a mixed old/new authority set while the durable marker exists; normal readers do not consult that marker. This does not satisfy the atomicity acceptance criteria. The ticket remains claimed and no commit was created.

- 2026-09-09 — Previous implementation agents exited without changing files or creating a commit. Dependencies 18 and 19 are resolved; the ticket is returned to `ready-for-agent` so its ownership is unambiguous. The unresolved acceptance gaps remain the staged-manifest backup mismatch, deleted-source diagnostic, legacy-v0 timeout, and marker-aware atomic swap/recovery.
