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
