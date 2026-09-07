# SPACE-method-contract-shape: Method Contract representation space

- Status: OPEN
- Provenance: PROPOSED
- Type: SPACE
- Revised: 2026-09-07

## Statement

The Method Contract must be one atomic versioned normative artifact that a fresh agent can read and a host-neutral validator can evaluate for A0 and A1-A7 artifacts, rule triggers, completion, verification, rationale traceability, and lifecycle without copying the guide's explanatory prose.

## Payload

```json
{
  "behavior": "Given a contract reference and artifact bundle, identify applicable rule obligations and determine schema validity and completion using repository-visible data.",
  "hard_invariants": [
    "one normative source with one version and digest",
    "contract contains normative decisions but not extended rationale",
    "no runtime code owns or copies method semantics",
    "host-neutral deterministic validation",
    "stable rule, artifact, check, and rationale identifiers",
    "unsupported versions and ambiguous completion fail closed"
  ],
  "dimensions": [
    "representation boundary",
    "schema vocabulary",
    "predicate mechanism",
    "artifact atomicity",
    "rationale ownership",
    "verification ownership",
    "lifecycle ownership"
  ],
  "candidate_classes": [
    "CAN-method-contract-schema-document",
    "CAN-method-contract-embedded-manifest",
    "CAN-method-contract-module-bundle"
  ],
  "pruned_combinations": [
    "Markdown-only contract: requires prose interpretation and cannot provide deterministic validation",
    "Arbitrary script callbacks: bind semantics to a host language and move trust into executable code",
    "Independent unpinned files: create multiple effective versions and non-atomic reads"
  ],
  "active_contradictions": [],
  "frame": "FRAME-methodology-skill-harness-system"
}
```
