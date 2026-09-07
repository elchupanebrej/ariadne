# CAN-independent-harness-versions: Independent component compatibility ranges

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Each owner publishes an independent semantic version and declares compatible consumer ranges; consumers resolve a combination at use time.

## Payload

```json
{
  "dependencies": [
    "FRAME-methodological-harness-lifecycle",
    "UNK-harness-lifecycle-release-topology"
  ],
  "mechanism_class": "decentralized range negotiation",
  "separation_principle": "State/Data",
  "state_owner": "each component owner",
  "system_boundary": "each component boundary",
  "supported_invariants": [
    "separate authority",
    "independent direct use"
  ],
  "known_violations": [
    "range overlap does not prove a tested whole-system combination",
    "resolution at use time weakens reproducibility"
  ],
  "change_radius": "declared dependents only",
  "falsification_predicate": "Reject if clean-session reproduction requires one immutable tested set."
}
```
