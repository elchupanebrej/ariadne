# CAN-method-contract-module-bundle: Pinned multi-file Method Contract bundle

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-09-07

## Statement

Use a manifest plus separate A0 and A1-A7 schemas, rule catalog, completion checks, verification hooks, and lifecycle files pinned by a lock manifest.

## Payload

```json
{
  "falsification_conditions": [
    "A single manifest represents all required cases without material duplication or unreadable size."
  ],
  "mechanism_class": "content-addressed multi-file contract module bundle",
  "operating_principle": "separate contract concerns across file and module boundaries",
  "state_owner": "The lock manifest selects normative modules; each module owns one contract concern.",
  "supported_invariants": [
    "modular ownership",
    "standard schemas",
    "independent reuse of artifact definitions"
  ],
  "known_violated_constraints": [
    "not the smallest readable representation",
    "requires a digest tree and atomic bundle-loading semantics"
  ],
  "useful_effect": "Each concern can evolve and be reviewed separately.",
  "harm": "Adds files, references, pinning, and partial-update failure states before any demonstrated scale need.",
  "change_radius": "bundle loader, lock validation, module compatibility, and distribution",
  "failure_modes": [
    "mixed module versions",
    "broken references",
    "partial publication",
    "more than one apparent source of truth"
  ],
  "required_evidence_requests": [
    "EVDREQ-method-contract-shape-prototype"
  ],
  "frame": "FRAME-methodology-skill-harness-system",
  "space": "SPACE-method-contract-shape"
}
```
