# CAN-lockstep-harness-release: Lockstep harness release train

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Publish the Method Contract, teaching skills, adapters, kernel, examples, and receipts under one shared release version and upgrade them together.

## Payload

```json
{
  "dependencies": [
    "FRAME-methodological-harness-lifecycle",
    "UNK-harness-lifecycle-release-topology"
  ],
  "mechanism_class": "single release train",
  "separation_principle": "Time",
  "state_owner": "central release owner",
  "system_boundary": "whole harness system",
  "supported_invariants": [
    "one obvious compatibility identity"
  ],
  "known_violations": [
    "merges release authority across separate owners",
    "forces unrelated changes and direct-use consumers into the same cadence"
  ],
  "change_radius": "all components for every release",
  "falsification_predicate": "Reject if separate owner authority or independent direct use is mandatory."
}
```
