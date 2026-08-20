# 12 — Epistemic quality gate and claim compatibility

**What to build:** Deterministic epistemic gate checking the 10-rung Evidentiary Ladder against claim categories, prohibiting unverified assumptions in locked decisions, and requiring adversarial critiques.

**Blocked by:** 08 — Weakest-precondition derivation engine, 09 — Transitive invalidation cascade engine

**Status:** ready-for-agent

- [ ] Rejects unit test evidence when submitted as proof for throughput/latency claims
- [ ] Prevents locking decisions (`DEC-*`) if any underlying dependency has ASSUMED or UNKNOWN provenance
- [ ] Requires an Adversarial Critique record before any candidate mechanism can be marked DECIDED
