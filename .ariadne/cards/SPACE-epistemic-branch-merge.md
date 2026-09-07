# SPACE-epistemic-branch-merge: Branch epistemic merge mechanism space

- Status: RESOLVED
- Provenance: PROPOSED
- Type: SPACE
- Revised: 2026-09-07

## Statement

Compare conflict-record representations that separate incompatible branch knowledge from the single active graph.

## Payload

```json
{
  "hard_invariants": [
    "no silent overwrite",
    "valid active graph",
    "representable divergence permits Git merge"
  ],
  "dimensions": [
    "preservation granularity",
    "conflict state owner",
    "active versus quarantined representation",
    "Git reconstruction dependency"
  ],
  "resolution": "Selected graph-native materialized variants with Git-backed history."
}
```
