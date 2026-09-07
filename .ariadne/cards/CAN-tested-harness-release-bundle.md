# CAN-tested-harness-release-bundle: Independent versions with tested release bundle

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Keep owner-controlled component versions and compatibility declarations, then publish an immutable release bundle that pins one tested version and digest per component without becoming their source of truth.

## Payload

```json
{
  "dependencies": [
    "FRAME-methodological-harness-lifecycle",
    "UNK-harness-lifecycle-release-topology"
  ],
  "mechanism_class": "federated component releases plus immutable assembly lock",
  "separation_principle": "System Boundary",
  "state_owner": "component owners for semantics; harness release owner for the tested lock",
  "system_boundary": "compatibility assembly boundary",
  "supported_invariants": [
    "separate authority",
    "reproducible clean sessions",
    "fail-closed exact pins",
    "independent direct use"
  ],
  "known_violations": [
    "adds one derived lock artifact and release check"
  ],
  "change_radius": "only affected component owners and assembled bundles",
  "falsification_predicate": "Reject if the derived lock becomes normative or if owners cannot declare compatibility without central coordination."
}
```
