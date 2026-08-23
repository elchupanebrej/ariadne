# 08 — Weakest-precondition derivation engine

**What to build:** Automatic provenance calculation for derived claims based on antecedent premises using the weakest-precondition meet operator.

**Blocked by:** 03 — Provenance lattice algebra and directed edges, 07 — Graph topological integrity and DAG validation

**Status:** resolved

- [ ] Any derived claim with an ASSUMED premise is clamped strictly to ASSUMED provenance
- [ ] Chains with UNKNOWN premises return UNRESOLVED_PREMISE
- [ ] DERIVED provenance is awarded only if all antecedent premises are FACT, MEASURED, or DERIVED

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: computeDerivedProvenance clamps ASSUMED, flags UNRESOLVED_PREMISE, gates DERIVED over FACT/MEASURED/DERIVED; derivation tests. Full suite green (53 files / 557+ tests), typecheck clean.
