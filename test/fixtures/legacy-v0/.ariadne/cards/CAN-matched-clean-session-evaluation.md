# CAN-matched-clean-session-evaluation: Matched held-out clean-session evaluation

- Status: SELECTED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Run versioned held-out tasks in two isolated sessions per tested environment, audit a closed input manifest, apply existing machine checks and blinded semantic review, and compare each added layer with a matched thinner baseline.

## Payload

```json
{
  "mechanism_class": "hermetic comparative contract evaluation",
  "separation_principle": "Operating Conditions and System Boundary",
  "state_owner": "the independent evaluation operator owns fixtures, arm assignment, isolation receipts, and result aggregation; source and runtime owners retain their semantics",
  "supported_invariants": [
    "auditable absence of hidden author context",
    "independent completion and transfer",
    "real owner-adapter boundary conformance",
    "non-compensatory safety verdicts",
    "deletion of unnecessary teaching or runtime layers"
  ],
  "known_constraints": [
    "results apply only to tested versions and environment combinations",
    "two runs demonstrate repeatability for the bounded fixture but are not a population-level pedagogy study",
    "semantic criteria without deterministic oracles require independent blinded review"
  ]
}
```
