# CAN-persisted-active-frame-spine: Persisted active-frame orientation spine

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-30

## Statement

Persist active frame, next action, progress, and stop point in a small repository orientation record updated after meaningful actions.

## Payload

```json
{
  "mechanism_class": "materialized continuation snapshot",
  "operating_principle": "write a compact current-work projection after each graph mutation and read it at session start",
  "separation_principle": "Time",
  "state_owner": "Ariadne harness orientation record derived from the graph",
  "system_boundary": "Repository state beside the Ariadne graph",
  "supported_invariants": [
    "bounded cold start",
    "human-readable stop point",
    "host neutrality"
  ],
  "known_violated_constraints": [
    "adds mutable derived state",
    "requires a freshness and concurrent-frame policy"
  ],
  "useful_effect": "fresh sessions need no frame argument when the pointer is current",
  "harm": "snapshot can become stale or ambiguous with concurrent frames",
  "change_radius": "mutation paths, state schema, recovery logic, and synchronization tests",
  "failure_modes": [
    "active frame points to closed work",
    "two frames race for global focus",
    "graph mutation succeeds but snapshot update fails"
  ],
  "required_evidence_requests": [
    "EVDREQ-peer-repository-harness-patterns"
  ],
  "falsification_predicate": "Reject if explicit frame-scoped derivation gives the same continuation outcome or if snapshot freshness cannot be proven after crash and concurrent work."
}
```
