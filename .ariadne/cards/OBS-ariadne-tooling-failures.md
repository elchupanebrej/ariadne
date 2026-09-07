# OBS-ariadne-tooling-failures: Ariadne tooling issues encountered during this run

- Status: ACTIVE
- Provenance: FACT
- Type: OBS
- Revised: 2026-09-07

## Statement

The Ariadne CLI and graph workflow exposed five operational/tooling problems during artifact creation.

## Payload

```json
{
  "falsification_conditions": [
    "A clean rerun demonstrates each behavior is already supported by the current CLI without workaround."
  ],
  "incidents": [
    {
      "code": "EDGE_TRF_SOURCE_REJECTED",
      "observed": "derived_from rejected TRF-uncertainty-first-ingress as a source because the edge endpoint contract omits TRF from proposition sources.",
      "workaround": "Used references instead of derived_from.",
      "impact": "The graph can store the relation but loses the intended derivation semantics."
    },
    {
      "code": "EDGE_VALSELECT_SOURCE_REJECTED",
      "observed": "depends_on rejected VAL-SELECT-uncertainty-ingress as a source because the edge endpoint contract omits VAL-SELECT from proposition sources.",
      "workaround": "Used references instead of depends_on.",
      "impact": "Value selection cannot express dependency edges using the canonical relation."
    },
    {
      "code": "SEMANTIC_GATE_REQUIRES_CANDIDATES",
      "observed": "The semantic gate rejected the active contradiction until three structurally distinct candidates with separation principles were present.",
      "workaround": "Added three candidates across operating condition, time, and system boundary.",
      "impact": "Expected gate behavior, but the diagnostic appeared only after partial artifact creation."
    },
    {
      "code": "STATE_NOT_UPDATED_BY_GRAPH_MUTATIONS",
      "observed": "node/edge mutations regenerated INDEX.md but did not update STATE.yaml frontier/open_unknowns.",
      "workaround": "Patched STATE.yaml explicitly after graph creation.",
      "impact": "A new session could miss the active frontier if it reads state before deriving it from the graph."
    },
    {
      "code": "HANDOFF_REQUIRES_DECISION",
      "observed": "The HANDOFF generator requires a DEC node, so it cannot produce a pre-decision substrate for grill-with-docs while unknowns remain open.",
      "workaround": "Used GRAPH.jsonl, INDEX.md, STATE.yaml, and the response frontier as the substrate.",
      "impact": "Pre-decision grilling has no dedicated persisted handoff artifact."
    }
  ],
  "affected_components": [
    "edge endpoint contracts",
    "semantic gate workflow",
    "STATE.yaml synchronization",
    "handoff generator"
  ]
}
```
