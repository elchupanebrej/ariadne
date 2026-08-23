# Decide the minimum Orchestration Harness contract

Type: grilling
Status: resolved
Blocked by: 01, 02
Parent: [Methodological Harness System](../map.md)

## Question

Given the external research and Ariadne boundary validation, which responsibilities, state, inputs, outputs, non-responsibilities, completion criteria, and failure behavior form the smallest Orchestration Harness contract—and does any remaining required behavior still justify a new runtime?

## Comments

- Grilling round 1: the user accepted the recommended execution floor and neutrality scope. A fresh session must identify exactly one valid next AFK action from repository-visible state, stop at HITL/approval/invalid-artifact/version-mismatch/ambiguous-side-effect boundaries, and preserve host-neutral orchestration semantics even if v1 has only one real host adapter.
- Grilling round 2: the user accepted the complete minimum contract and conditional runtime verdict, then confirmed shared understanding.

## Answer

The Orchestration Harness is a host-neutral executable boundary that lets a fresh session continue from repository-visible owner receipts and stop safely at human, approval, artifact, version, or ambiguous-effect boundaries.

### Minimum contract

- **Responsibilities:** persist an orchestration attempt; pin Method Contract, adapter, workspace, and input versions; assemble ordered context pointers; invoke, resume, or cancel through owner-controlled adapters; validate generic artifact and receipt gates; record pending actions, replay declarations, lifecycle events, and trace correlation.
- **Owned state:** only run/session ID, opaque step reference, lifecycle status, attempt number, version pins, idempotency key/deadline, event cursor, and owner-issued receipt/artifact/pending-action pointers.
- **Inputs:** Method Contract, skill/task, workspace, context/artifact references, interaction mode, adapter capabilities, and prior receipt/event cursor when resuming.
- **Outputs:** `succeeded`, `waiting`, `failed`, or `canceled`, with validated owner pointers, diagnostics/trace correlation, and an opaque next-step or terminal disposition.
- **Completion:** the pinned Method Contract predicate passes from schema-valid owner receipts and artifact envelopes, pins match, and no required human answer or approval remains.
- **Failure:** fail closed on invalid artifacts, unsupported versions/capabilities, or ambiguous effects; never synthesize human input; retry only owner-declared replay-safe work; retain partial receipts without compensating through owner state.
- **Non-responsibilities:** no model/tool loop, skill discovery, tracker semantics, Ariadne graph semantics, copied Method Contract rules, human answers, host permission enforcement, database, queue, scheduler, distributed transaction coordinator, or plugin marketplace.

### Runtime verdict

A minimal executable kernel is justified as the conditional contract target, but no standalone runtime service or new agent framework is justified. The kernel may be a library, CLI, or in-process component with repository-visible attempt state and one real host adapter. Delete or inline it if the Rung 6 clean-session comparison shows that the thin baseline or a host-native implementation satisfies every hard invariant.

### Ariadne context

- [`DEC-minimum-orchestration-contract`](../../../.ariadne/GRAPH.jsonl) records the locked contract.
- [`VAL-SELECT-minimum-orchestration-contract`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter.
- [`EVDREQ-clean-session-runtime-necessity`](../../../.ariadne/GRAPH.jsonl) keeps runtime permanence falsifiable.
