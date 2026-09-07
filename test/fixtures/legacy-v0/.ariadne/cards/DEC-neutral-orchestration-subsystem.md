# DEC-neutral-orchestration-subsystem: The runtime is a neutral orchestration subsystem

- Status: PROVISIONAL
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

If a new runtime is justified, it is conceptually a neutral third subsystem with bounded owner-controlled adapters to Matt Pocock Skills, Ariadne, the Method Contract, and the host; it may be physically co-located but must not own their semantics or state.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "User selected the ownership boundary; Rung 1 Ariadne validation found it statically coherent.",
  "candidate": "CAN-dedicated-orchestration-runtime",
  "evidence": [
    "EVD-neutral-orchestration-boundary-r1"
  ],
  "validation_result": "Boundary coherence supported at Rung 1; runtime necessity inconclusive; implemented adapters require Rung 6.",
  "adversarial_critique": [
    "Free-form Matt outputs may force semantic parsing unless an owner-controlled adapter exists.",
    "A runtime ledger becomes a second tracker if it stores workflow status rather than attempt state and pointers.",
    "Cross-owner atomicity would force shared ownership; no such requirement is currently present.",
    "The host loader and Ariadne controller may make the runtime a removable pass-through."
  ],
  "unresolved_risks": [
    "ASM-dedicated-runtime-necessity",
    "programmatic Matt invoke/cancel/HITL/receipt availability",
    "host-neutral packaging model",
    "Rung 6 adapter compatibility"
  ],
  "reopen_condition": "Any required behavior forces duplicated semantic/state ownership, a live dependency cycle, or failure of direct Matt/Ariadne use."
}
```
