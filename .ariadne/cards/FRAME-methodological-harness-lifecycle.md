# FRAME-methodological-harness-lifecycle: Methodological harness lifecycle

- Status: OPEN
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-09-07

## Statement

Each independently owned Method Contract, teaching skill, adapter, kernel, example, and self-application receipt must evolve without silent incompatibility or indefinite compatibility debt.

## Payload

```json
{
  "context": "The design already separates normative, workflow, epistemic, host, and orchestration ownership while clean sessions require exact audited inputs.",
  "required_behavior": "Given any proposed component change, owners can determine affected consumers, produce a compatible or explicitly migrated release set, trigger review, collect feedback, and retire obsolete versions only after executable evidence shows no supported consumer remains.",
  "proposed_mechanism": "Ticket 12 considers lockstep releases, independent compatibility ranges, and immutable tested release bundles; none is yet selected.",
  "preconditions": [
    "Component ownership remains separate",
    "Every runtime attempt and clean-session run pins versions and digests",
    "The Method Contract is the single normative method source"
  ],
  "postconditions": [
    "Every released combination is either explicitly supported or rejected before dispatch",
    "Normative changes reach all affected derived consumers without copying owner state",
    "Deprecated compatibility paths have an owner, migration path, deadline, and executable retirement check"
  ],
  "invariants": [
    "Physical co-location does not merge decision rights",
    "The harness never infers compatibility from prose or unpinned latest versions",
    "Self-consistency receipts never substitute for external compatibility evidence",
    "Direct Matt and Ariadne use remains valid"
  ],
  "constraints": [
    "Use repository-visible artifacts",
    "Fail closed on unsupported format, version, digest, or capability",
    "Delete or inline the kernel if the thin baseline passes"
  ],
  "behavioral_delta": "Prior tickets fix representation, pins, owner boundaries, and evaluation but do not define release relationships or end-of-life policy.",
  "perspectives": {
    "component_owner": "must control semantic releases and compatibility declarations",
    "operator": "needs one reproducible supported set",
    "direct_user": "must not need the neutral harness",
    "maintainer": "needs bounded migration and deletion"
  },
  "unknowns": [
    "UNK-harness-lifecycle-release-topology"
  ],
  "contradictions": [],
  "provenance": {
    "facts": "tickets 03-11 and map.md",
    "requirement": "ticket 12"
  },
  "success_observer": "A release reviewer can reject every unsupported combination from repository artifacts and can prove a retired version has no supported consumer or active pinned run."
}
```
