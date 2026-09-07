# OBS-merge-causal-relations: Invalidation and gate dependency relations differ

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

Current invalidation influence traverses reversed depends_on and derived_from relations, forward supports and invalidates relations, and does not include node.dependencies; the epistemic gate separately reads depends_on, derived_from, and node.dependencies.

## Payload

```json
{
  "source": "src/graph/invalidation.ts and src/gates/epistemic-gate.ts"
}
```
