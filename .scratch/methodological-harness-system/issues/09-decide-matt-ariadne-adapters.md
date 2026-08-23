# Decide the Matt Pocock Skills and Ariadne adapter contracts

Type: prototype
Status: resolved
Blocked by: 02, 03
Parent: [Methodological Harness System](../map.md)

## Question

Which invocation, cancellation, handoff, receipt, error, and ownership contracts let the Orchestration Harness coordinate Matt Pocock Skills and Ariadne while keeping direct use possible and preventing duplicated workflow or epistemic state?

## Comments

- [Throwaway Matt and Ariadne adapter-contract prototype](../prototypes/09-matt-ariadne-adapter-contracts.throwaway.html) exercises coordinated invocation, HITL resumption, direct-use import, cancellation acknowledgment, ambiguous-effect inspection, invalid receipts, unsupported capabilities, replay rejection, and shadow-state rejection. Its embedded self-check reports `9 deterministic paths passed`; SHA-256 `465bd7253c75913ca80ad7118224f3e916d91d74f2f85f45038b8c178d8d316b`.
- Provisional recommendation for HITL review: select one shared pointer-only lifecycle surface with owner-specific Matt and Ariadne request/receipt envelopes. The host executes and cancels processes; Matt owns workflow meaning; Ariadne owns epistemic meaning and graph writes; the harness owns only attempt state, pins, pointers, generic gates, and cancellation intent.
- The user accepted the prototype and recommended contract.

## Answer

Use one shared pointer-only lifecycle surface, implemented by owner-approved Matt and Ariadne adapters:

```text
capabilities()
start(request_ref)
resume(external_run_ref, input_ref)
cancel(external_run_ref, reason_ref)
events(external_run_ref, cursor)
```

Every request pins its schema and adapter version, owner operation, workspace revision, ordered context/input pointers, interaction mode, and any owner-declared idempotency key or deadline. Every outcome contains only lifecycle status, effect state, external run reference, event cursor, and owner receipt, artifact, pending-action, diagnostic, and trace pointers.

### Owner-specific contracts

- **Matt:** the request names a pinned skill and required artifact kinds. The host runs the skill. The Matt adapter validates Matt-owned receipts; it never converts workflow prose, issue state, or human answers into harness state.
- **Ariadne:** the request names a pinned preflight, graph, ingest, gate, invalidation, or handoff operation. Ariadne alone validates and mutates its graph, returning revision and event pointers rather than copied nodes.
- **Host:** owns the model/tool loop, native session, permissions, sandbox, traces, process execution, and physical cancellation.

### Handoff, cancellation, and errors

- Ariadne-to-Matt handoff is a substrate pointer. Matt-to-Ariadne handoff is an eligible receipted artifact through Ariadne's existing ingest boundary.
- Direct Matt or Ariadne use remains valid. A direct result may join orchestration later only through pinned owner receipt and artifact pointers; the harness does not intercept it.
- Cancellation is intent until the owner returns a terminal receipt. An ambiguous effect stops for owner inspection; the harness never infers rollback, compensation, or replay.
- Unsupported capabilities or invalid pins fail before execution. Invalid receipts and protocol violations fail closed. Human, approval, and ambiguous-effect conditions remain `waiting`. Retry requires an owner replay declaration.

### Ownership

The harness owns only attempt ID, opaque step, pins, pointers, event cursor, generic gates, and cancellation intent. Matt and the tracker retain workflow state; Ariadne retains epistemic state; the Method Contract retains normative rules; humans retain answers, approvals, judgments, and compensation authority. Adapters own only translation, capability declaration, validation, lifecycle normalization, and conformance receipts.

The decision is structurally supported at Rung 3. Real host invocation, cancellation, structured Matt receipts, and cross-boundary compatibility remain subject to the Rung 6 clean-session contract test; delete or inline any pass-through adapter a thinner path makes unnecessary.

### Decision records

- [`DEC-matt-ariadne-adapter-contract`](../../../.ariadne/GRAPH.jsonl) records the accepted contract.
- [`DEP-matt-ariadne-adapter-boundary`](../../../.ariadne/GRAPH.jsonl) records ownership, coupling classes, change radius, and the dependency matrix.
- [`VAL-SELECT-matt-ariadne-adapter-contract`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter and adversarial critique.
- [`EVD-matt-ariadne-adapter-prototype-r3`](../../../.ariadne/GRAPH.jsonl) records the nine-path prototype receipt.
- [`OBS-adapter-contract-post-evidence-gate`](../../../.ariadne/GRAPH.jsonl) records passing task-local graph checks and the two unrelated repository-wide diagnostics.
