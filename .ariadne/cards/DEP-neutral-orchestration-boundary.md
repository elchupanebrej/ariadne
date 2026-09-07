# DEP-neutral-orchestration-boundary: Neutral runtime dependency boundary

- Status: OPEN
- Provenance: PROPOSED
- Type: DEP
- Revised: 2026-09-07

## Statement

Preliminary dependency model for validating the neutral orchestration boundary before architecture lock.

## Payload

```json
{
  "changed_component": "new orchestration runtime",
  "owner": "neutral orchestration subsystem",
  "candidate": "CAN-dedicated-orchestration-runtime",
  "coupling_classes": {
    "static": "adapter interfaces to Matt skills and Ariadne CLI/API",
    "dynamic": "skill invocation, handoff, cancellation, and result collection",
    "data": "runtime session receipts reference but do not copy tracker issues, Ariadne graph nodes, or Method Contract rules",
    "deployment": "unknown until host and packaging decisions are resolved",
    "event": "invocation and completion envelopes across adapters",
    "migration": "no existing runtime state to migrate; compatibility with existing direct skill invocations must remain"
  },
  "direct_dependents": [
    "Methodology Authoring Teaching Skill",
    "Harness Authoring Teaching Skill",
    "methodology self-harness"
  ],
  "transitive_dependents": [
    "clean-session pilots",
    "version and lifecycle checks",
    "future methodology packages"
  ],
  "change_radius": "architectural",
  "boundary_contracts": [
    "Matt adapter owns workflow invocation and returns opaque workflow receipts",
    "Ariadne adapter owns epistemic mutations and returns graph receipts",
    "Method Contract adapter exposes versioned rule and artifact identifiers",
    "runtime owns only orchestration session state and cross-adapter correlation IDs"
  ],
  "required_invariants": [
    "one owner per critical datum",
    "no duplicated normative rules",
    "no runtime mutation of external state except through owner APIs",
    "direct Matt or Ariadne usage remains possible"
  ],
  "evidence_requests": [
    "EVDREQ-neutral-orchestration-boundary"
  ]
}
```
