# VAL-SELECT-harness-lifecycle-topology: Select tested harness release bundles

- Status: SELECTED
- Provenance: DECIDED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select independent owner versions assembled into an immutable tested release bundle; reject a lockstep train and use-time compatibility-range resolution because each fails a hard ownership or reproducibility requirement.

## Payload

```json
{
  "dependencies": [
    "FRAME-methodological-harness-lifecycle",
    "CAN-lockstep-harness-release",
    "CAN-independent-harness-versions",
    "CAN-tested-harness-release-bundle"
  ],
  "hard_requirements": [
    "separate component decision rights",
    "exact version and digest pins",
    "reproducible clean-session inputs",
    "fail closed before dispatch",
    "direct Matt and Ariadne use remains valid"
  ],
  "candidate_results": {
    "CAN-lockstep-harness-release": "FAIL: central release authority and all-component change radius violate separate ownership and independent direct use",
    "CAN-independent-harness-versions": "FAIL: use-time range resolution does not identify one tested reproducible system",
    "CAN-tested-harness-release-bundle": "PASS: owner versions remain independent while one derived lock pins the tested assembly"
  },
  "preference_observations": {
    "mutable_state": "one immutable derived lock only",
    "change_radius": "affected component owners and bundle",
    "operations": "one pre-dispatch exact-pin check",
    "cognitive_load": "component versions plus one bundle ID"
  },
  "evidence_rung": 1,
  "assumptions": [
    "component owners can publish explicit compatibility declarations"
  ],
  "unknowns": [],
  "adversarial_critique": [
    "The bundle could become a shadow normative source; response: it stores only component IDs, versions, digests, compatibility receipts, and evidence pointers.",
    "A central assembler could usurp owner releases; response: it may reject an assembly but cannot publish or reinterpret a component version.",
    "Many bundles could accumulate; response: retirement requires no supported consumer or active pinned run and an executable absence check."
  ],
  "selection": "CAN-tested-harness-release-bundle",
  "owner": "user",
  "provenance": "tickets 03-11 plus user acceptance in ticket 12 round 1"
}
```
