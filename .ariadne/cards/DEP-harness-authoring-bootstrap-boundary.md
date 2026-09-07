# DEP-harness-authoring-bootstrap-boundary: Harness-authoring bootstrap and ownership coupling

- Status: MAPPED
- Provenance: PROPOSED
- Type: DEP
- Revised: 2026-09-07

## Statement

Harness authoring changes one build-stage teaching package and the design handoff to orchestration; active runtime dependencies remain acyclic because HA_n is absent from the OH_n execution graph.

## Payload

```json
{
  "dependencies": [
    "DEC-staged-fixed-point-contract",
    "DEC-minimum-orchestration-contract",
    "DEC-method-contract-shape",
    "CAN-failure-driven-harness-vertical-slice"
  ],
  "changed_component": "Harness Authoring Teaching Skill HA_n",
  "owner": "Method Contract owner approves normative method changes; teaching-skill owner maintains pedagogy and examples.",
  "required_invariants": [
    "G_n, M_n, MA_n, and harness research are immutable pinned inputs to HA_n",
    "HA_n may specify OH_n but is not an OH_n runtime dependency",
    "owner state crosses boundaries only as resolvable pointers and receipts",
    "accepted normative deltas start a new immutable bootstrap round"
  ],
  "coupling_classes": {
    "static": "G_n + M_n + MA_n + pinned research -> HA_n; M_n + HA_n + adapter contracts -> OH_n",
    "dynamic": "OH_n -> owner adapter -> methodology-authoring -> pinned M_n; HA_n is absent",
    "data": "Method owner owns rules; Ariadne owns epistemic graph; tracker owns work; host owns model, tools, permissions, and native traces; harness owns attempt pointers and gates",
    "deployment": "Release set pins every component version and digest; no implied independent service",
    "event": "Harness records normalized lifecycle events and owner receipt pointers, never copied owner payload state",
    "migration": "A normative delta stops the round; owner-approved changes rebuild affected consumers in b_(n+1)"
  },
  "direct_dependents": [
    "OH_n design handoff",
    "clean-session teaching evaluation",
    "structural-v1 bootstrap bundle"
  ],
  "transitive_dependents": [
    "adapter safety and recovery contract",
    "fixed-point assessment bundles",
    "version propagation and retirement"
  ],
  "change_radius": [
    "HA_n lesson package",
    "OH_n design inputs",
    "bootstrap.lock pins",
    "ticket 11 evaluation fixtures"
  ],
  "boundary_contracts": [
    "Teaching skill owns lesson order, worked examples, prompts, and checks only.",
    "Harness consumes pinned owner contracts and emits pointer-only attempts, events, artifacts, and pending actions.",
    "Method and owner semantics never move into the teaching skill or harness."
  ]
}
```
