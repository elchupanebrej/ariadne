# CAN-thin-owner-artifact-baseline: Thin owner-artifact baseline

- Status: DEFERRED
- Provenance: DECIDED
- Type: CAN
- Revised: 2026-09-07

## Statement

Use the existing skill loader and owner receipts directly, reconstructing continuation on each invocation without a neutral kernel ledger.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate",
    "CTR-minimal-kernel-vs-atomic-continuity"
  ],
  "mechanism_class": "stateless owner-artifact continuation",
  "operating_principle": "derive the next action from owner artifacts at invocation time",
  "separation_principle": "Time",
  "state_owner": "Matt, Ariadne, host, Method Contract, and human owners only",
  "system_boundary": "existing host and owner tools",
  "supported_invariants": [
    "direct use",
    "zero new mutable state",
    "immediate deletion"
  ],
  "known_violated_constraints": [
    "no repository-owned revision check serializes dispatch intent across independent resumers unless the host already supplies an equivalent primitive"
  ],
  "useful_effect": "smallest possible implementation",
  "harm": "atomic continuation is assumed rather than owned",
  "change_radius": "none",
  "failure_modes": [
    "two fresh sessions dispatch the same opaque step",
    "crash after effect loses unique disposition"
  ],
  "required_evidence_requests": [
    "EVDREQ-kernel-packaging-prototype-r3"
  ],
  "falsification_predicate": "Falsified as a permanent baseline if a matched clean session cannot prevent duplicate dispatch or recover unique disposition from declared owner artifacts.",
  "disposition": "Mandatory matched Rung 6 deletion baseline; replace the selected kernel if it satisfies every hard invariant.",
  "adversarial_critique": [
    "Zero new state is attractive, but independent fresh resumers have no harness-owned compare-and-append; retain this as an empirical deletion baseline rather than assuming host atomicity.",
    "If Rung 6 exposes an equivalent host-native primitive, this candidate wins and the kernel must be deleted or inlined."
  ]
}
```
