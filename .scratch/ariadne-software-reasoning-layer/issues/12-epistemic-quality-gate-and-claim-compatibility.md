# 12 — Epistemic quality gate and claim compatibility

**What to build:** Deterministic epistemic gate checking the 10-rung Evidentiary Ladder against claim categories, prohibiting unverified assumptions in locked decisions, and requiring adversarial critiques.

**Blocked by:** 08 — Weakest-precondition derivation engine, 09 — Transitive invalidation cascade engine

**Status:** resolved

- [ ] Rejects unit test evidence when submitted as proof for throughput/latency claims
- [ ] Prevents locking decisions (`DEC-*`) if any underlying dependency has ASSUMED or UNKNOWN provenance
- [ ] Requires an Adversarial Critique record before any candidate mechanism can be marked DECIDED

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: methodIncompatibleWithClaim, UNRESOLVED_DECISION_DEPENDENCY, MISSING_ADVERSARIAL_CRITIQUE all implemented+tested in epistemic-gate. Full suite green (53 files / 557+ tests), typecheck clean.
