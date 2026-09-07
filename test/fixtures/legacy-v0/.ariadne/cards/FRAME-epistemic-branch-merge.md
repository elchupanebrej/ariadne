# FRAME-epistemic-branch-merge: Merge divergent branch epistemic models

- Status: RESOLVED
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-08-30

## Statement

Ariadne must merge divergent Git-branch epistemic models without silent overwrite, keep the active Epistemic Graph valid, and allow Git integration when disagreement is representable.

## Payload

```json
{
  "required_behavior": "Given a common ancestor and two branch models, preserve compatible knowledge, expose incompatible knowledge for later reconciliation, and distinguish epistemic divergence from technical corruption.",
  "invariants": [
    "No branch model is silently selected by event ordering",
    "The active graph preserves schema, referential integrity, and deductive DAG invariants",
    "A representable epistemic divergence does not by itself fail the Git merge"
  ],
  "source": ".scratch/epistemic-branch-merge/spec.md",
  "resolution": "Decision-complete specification confirmed by the user; see ADR 0014 and DEC-merge-contract-confirmed."
}
```
