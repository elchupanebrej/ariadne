# CAN-dedicated-orchestration-runtime: Minimal neutral orchestration kernel

- Status: PROPOSED
- Provenance: PROPOSED
- Type: CAN
- Revised: 2026-08-24

## Statement

Provide host-neutral fresh-session enforcement as the smallest executable kernel: a repository-visible attempt ledger, version pins, ordered context pointers, owner-adapter invocation, artifact and receipt gates, interruption outcomes, replay metadata, and trace correlation. It may run as a library, CLI, or in-process component; no standalone service is required.

## Payload

```json
{
  "falsification_conditions": [
    "The thin baseline satisfies every required fresh-session, artifact, interruption, replay, and version invariant without undocumented human memory",
    "A conforming implementation must parse or duplicate Matt, Ariadne, Method Contract, host, or human-owned semantics",
    "The kernel cannot remain host-neutral without a second authoritative state owner"
  ],
  "mechanism_class": "minimal neutral executable orchestration kernel with bounded owner adapters",
  "state_owner": "The kernel owns only orchestration attempts and immutable pointers; Matt skills and the tracker own workflow semantics, Ariadne owns epistemic state, the Method Contract owns normative rules, the host owns permissions and process state, and humans own their answers.",
  "supported_invariants": [
    "A fresh session can identify exactly one valid next AFK action from repository-visible owner receipts",
    "HITL, approval, invalid-artifact, version-mismatch, and ambiguous-side-effect boundaries stop advancement",
    "Orchestration semantics remain host-neutral",
    "Direct Matt and Ariadne use remains valid"
  ],
  "known_constraints": [
    "One owner-controlled adapter seam is required",
    "Runtime permanence remains subject to the clean-session deletion test",
    "Safety and recovery details remain owned by their downstream ticket"
  ],
  "non_responsibilities": [
    "model or tool loop",
    "skill discovery",
    "tracker semantics",
    "Ariadne graph mutation",
    "Method Contract rules",
    "host permission enforcement",
    "generic database, queue, scheduler, or plugin marketplace"
  ]
}
```
