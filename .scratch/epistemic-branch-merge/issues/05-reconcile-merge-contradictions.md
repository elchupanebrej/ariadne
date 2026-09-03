# 05 — Reconcile Merge Contradictions atomically

**What to build:** Give agents and decision owners one compare-and-swap reconciliation command that converts a Merge Contradiction into validated canonical graph changes and safely releases any now-valid Causal Quarantine.

**Blocked by:** 03 — Quarantine edge and topology divergence; 04 — Detect Decision Scope divergence without changing authority.

**Status:** resolved

- [ ] Reconciliation requires the contradiction ID and expected conflict digest and accepts exactly one mode: select stored base or variant by content digest, or submit one schema-valid `ariadne-delta`.
- [ ] Selecting by branch label, providing both or neither mode, or supplying an arbitrary replacement graph is rejected without mutation.
- [ ] One Graph Engine transaction validates the selected or synthesized changes, prospective graph, released quarantine, evidence rules, and required authority before appending anything.
- [ ] A stale expected digest, invalid delta, invalid prospective graph, or missing decision-owner authorization leaves graph history and generated projections unchanged.
- [ ] Valid non-decision reconciliation can be completed by an agent under normal evidence rules, while changing a locked decision requires decision-owner authorization.
- [ ] Successful reconciliation appends canonical values, restores only now-valid quarantined knowledge, marks the contradiction resolved, and retains its historical record.
- [ ] Repeated or concurrent attempts cannot expose a partially reconciled graph and receive a clear structured outcome.

## Comments

- 2026-09-03: Implemented and committed as `30ab966`. Build/typecheck and focused reconciliation tests passed; the two-axis review passed. The full suite had three unrelated gate/help failures.
