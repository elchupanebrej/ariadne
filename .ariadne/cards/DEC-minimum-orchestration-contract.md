# DEC-minimum-orchestration-contract: Minimum Orchestration Harness contract

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

The Orchestration Harness is a host-neutral executable boundary that lets a fresh session continue from repository-visible owner receipts and stops safely at human, approval, artifact, version, or ambiguous-effect boundaries. It owns only orchestration-attempt state and is implemented no larger than a library, CLI, or in-process kernel; no standalone service is approved.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "The user accepted both recommended frontier decisions, then accepted the complete contract and confirmed shared understanding in the Wayfinder grilling session.",
  "candidate": "CAN-dedicated-orchestration-runtime",
  "selection": "VAL-SELECT-minimum-orchestration-contract",
  "evidence": [
    "EVD-modern-agent-harness-practices",
    "EVD-neutral-orchestration-boundary-r1"
  ],
  "responsibilities": [
    "persist an orchestration attempt in repository-visible state",
    "pin Method Contract, adapter, workspace, and input versions",
    "assemble ordered context pointers and digests",
    "invoke, resume, or cancel through owner-controlled adapters",
    "validate generic artifact and owner-receipt gates before advancing",
    "record pending external actions, replay declarations, lifecycle events, and trace correlation"
  ],
  "owned_state": [
    "run or session ID",
    "opaque step reference",
    "created, running, waiting, succeeded, failed, or canceled status",
    "attempt number",
    "version and digest pins",
    "idempotency key and deadline",
    "event cursor",
    "owner-issued receipt, artifact, and pending-action pointers"
  ],
  "inputs": [
    "Method Contract reference and digest",
    "skill and task references",
    "workspace reference and revision",
    "ordered context and artifact references",
    "AFK or HITL interaction mode",
    "adapter capability snapshot",
    "prior receipt and event cursor when resuming"
  ],
  "outputs": [
    "succeeded, waiting, failed, or canceled outcome",
    "validated artifact and owner-receipt pointers",
    "diagnostic and trace-correlation pointers",
    "opaque next-step reference or terminal disposition"
  ],
  "completion_criteria": [
    "the pinned Method Contract completion predicate passes using schema-valid owner receipts and artifact envelopes",
    "all required digests and version pins match",
    "no required human answer or host approval remains unresolved"
  ],
  "failure_behavior": [
    "fail closed on missing or invalid artifacts, unsupported versions or capabilities, and ambiguous external effects",
    "never synthesize a human answer or approval",
    "retry only work declared replay-safe by its owner",
    "retain partial owner receipts and mark the attempt incomplete instead of compensating through external state mutation",
    "record and forward cancellation intent while leaving detailed safety semantics to the runtime safety ticket"
  ],
  "non_responsibilities": [
    "model or tool loop",
    "skill discovery or Matt workflow semantics",
    "issue tracker state",
    "Ariadne graph, provenance, or gate semantics",
    "Method Contract rules",
    "human answers",
    "host credentials, permission decisions, or sandbox enforcement",
    "generic database, queue, scheduler, distributed transaction coordinator, or plugin marketplace"
  ],
  "implementation_verdict": "A minimal executable kernel is justified as a conditional contract target; no standalone runtime service is justified. Delete or inline the kernel if EVDREQ-clean-session-runtime-necessity shows a thinner eligible implementation satisfies every invariant.",
  "unresolved_risks": [
    "ASM-dedicated-runtime-necessity",
    "EVDREQ-clean-session-runtime-necessity",
    "programmatic owner-controlled Matt invocation receipts",
    "Rung 6 adapter compatibility",
    "detailed locking, retry, cancellation, and recovery policy in downstream tickets"
  ],
  "reopen_condition": "A required behavior forces duplicated owner semantics, cross-owner atomicity, a live dependency cycle, or a thinner implementation passes the full contract.",
  "adversarial_critique": [
    "The kernel can become a second tracker or epistemic store if pointer-only state is violated.",
    "Host-native lifecycle features may make the kernel redundant.",
    "Generic completion evaluation can accidentally copy Method Contract semantics into runtime code.",
    "Automatic retry of ambiguous effects can duplicate external mutations.",
    "A standalone process or service would exceed the selected behavioral requirement."
  ]
}
```
