# CAN-layered-method-skill-harness: Layered method, skill, and harness package

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Separate the responsibilities of the normative method, reloadable teaching skill, worked example, artifact templates, and executable checks, but package them on the existing skill loader and Ariadne CLI; add a new orchestration runtime only if research or a clean-session pilot exposes a missing behavior.

## Payload

```json
{
  "falsification_conditions": [
    "A clean-session pilot needs behavior the existing skill loader or Ariadne CLI cannot provide",
    "A reviewer cannot identify the authoritative normative rule source",
    "Changes require manual synchronization across duplicated normative copies"
  ],
  "mechanism_class": "layered contracts in one thin agent-facing package",
  "state_owner": "Ariadne CLI owns epistemic execution state; the method owns normative rules; the entry skill owns progressive disclosure and routing; examples and templates are subordinate resources",
  "supported_invariants": [
    "self-application remains inspectable",
    "fresh-session teaching is explicit",
    "runtime ownership is acyclic",
    "existing platform capabilities are reused"
  ],
  "known_constraints": [
    "responsibilities must remain named even when files are co-located",
    "normative rules must not be duplicated across entry skill and resources"
  ]
}
```
