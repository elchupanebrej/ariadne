# OBS-adapter-dependency-edge-contract: Dependency cards cannot use depends_on edges

- Status: OBSERVED
- Provenance: FACT
- Type: OBS
- Revised: 2026-08-24

## Statement

The current Ariadne edge schema rejected DEP as a depends_on source and target while wiring the accepted adapter decision.

## Payload

```json
{
  "command": "ariadne edge add DEP-matt-ariadne-adapter-boundary depends_on DEC-minimum-orchestration-contract; ariadne edge add DEC-matt-ariadne-adapter-contract depends_on DEP-matt-ariadne-adapter-boundary",
  "error": "depends_on edges have an invalid source or target node type",
  "workaround": "Use references edges; retain the full dependency matrix inside the DEP card.",
  "impact": "Graph relation is less specific, but ownership, change radius, and boundary contracts remain persisted.",
  "component": "Ariadne EdgeSchema endpoint contract"
}
```
