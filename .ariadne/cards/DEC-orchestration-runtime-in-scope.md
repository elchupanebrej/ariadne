# DEC-orchestration-runtime-in-scope: Executable orchestration boundary is in scope

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Executable orchestration is in scope because the user requires host-neutral fresh-session continuation with deterministic stop boundaries. The implementation is limited to a minimal kernel that may be a library, CLI, or in-process component; no standalone service or new agent framework is approved, and the kernel must be deleted or inlined if the thin baseline satisfies the same contract.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "The user accepted the recommended execution floor, host-neutral semantics, minimum contract, and conditional runtime verdict during the Wayfinder grilling ticket.",
  "candidate": "CAN-dedicated-orchestration-runtime",
  "evidence": [
    "EVD-modern-agent-harness-practices",
    "EVD-neutral-orchestration-boundary-r1"
  ],
  "hard_requirements": [
    "repository-visible fresh-session continuation",
    "deterministic stop at HITL and approval boundaries",
    "fail-closed invalid artifact and version handling",
    "no automatic replay of ambiguous effects",
    "host-neutral semantics",
    "single owner for every critical datum",
    "direct Matt and Ariadne use remains valid"
  ],
  "unresolved_risks": [
    "ASM-dedicated-runtime-necessity",
    "clean-session baseline comparison",
    "programmatic Matt invoke, cancel, HITL, and receipt availability",
    "Rung 6 adapter compatibility"
  ],
  "reopen_condition": "The thin loader plus Ariadne CLI or a host-native implementation satisfies every required invariant without a distinct kernel, or a kernel forces duplicated ownership or a live dependency cycle.",
  "adversarial_critique": [
    "The kernel may be a removable pass-through over host sessions and Ariadne controller capabilities.",
    "Its ledger becomes a second tracker if it stores semantic workflow status instead of attempts and owner pointers.",
    "Free-form Matt outputs may force forbidden semantic parsing unless an owner-controlled receipt adapter exists.",
    "A new service, database, queue, scheduler, or agent loop would exceed the behavior the user selected."
  ]
}
```
