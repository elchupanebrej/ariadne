# CAN-ariadne-controller-kernel: Extend AriadneHarnessController

- Status: REJECTED
- Provenance: DECIDED
- Type: CAN
- Revised: 2026-08-24

## Statement

Add orchestration attempts and dispatch events to the existing AriadneHarnessController and GraphStorage so one current module owns integration and persistence.

## Payload

```json
{
  "dependencies": [
    "FRAME-kernel-packaging-substrate",
    "CTR-minimal-kernel-vs-atomic-continuity",
    "OBS-existing-ariadne-harness-seam"
  ],
  "mechanism_class": "epistemic-controller extension",
  "operating_principle": "reuse Ariadne graph transactions for orchestration events",
  "separation_principle": "Operating Condition",
  "state_owner": "Ariadne controller",
  "system_boundary": "src/harness/controller.ts and Ariadne storage root",
  "supported_invariants": [
    "existing Node stack",
    "atomic local GraphStorage transactions",
    "few new files"
  ],
  "known_violated_constraints": [
    "neutral attempt state becomes Ariadne-owned",
    "direct Matt orchestration depends on Ariadne graph schema",
    "workflow and orchestration events pollute epistemic state"
  ],
  "useful_effect": "maximal code reuse",
  "harm": "merges domain ownership and raises graph change radius",
  "change_radius": "Ariadne schemas, graph gates, controller, CLI, adapters, and migrations",
  "failure_modes": [
    "shadow orchestration state in the epistemic graph",
    "Ariadne graph migration blocks neutral recovery"
  ],
  "required_evidence_requests": [
    "EVDREQ-kernel-packaging-prototype-r3"
  ],
  "falsification_predicate": "Rejected if neutral attempts cannot be represented without Ariadne node semantics or storage ownership.",
  "disposition": "Rejected because orchestration attempts are not Ariadne epistemic state.",
  "adversarial_critique": [
    "Code reuse is high, but storage lifecycle and schema semantics would make neutral attempt continuity Ariadne-owned and couple direct Matt orchestration to the epistemic graph.",
    "Reuse the transaction algorithm only; sharing state ownership is not required for sharing an implementation pattern."
  ]
}
```
