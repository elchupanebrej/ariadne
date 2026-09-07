# DEC-matt-ariadne-adapter-contract: Pointer-only Matt and Ariadne adapter contracts

- Status: PROVISIONAL
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Coordinate Matt Pocock Skills and Ariadne through one five-operation pointer-only lifecycle surface with owner-specific request and receipt envelopes; keep host execution, Matt workflow semantics, Ariadne epistemic semantics, Method Contract rules, tracker state, and human decisions with their current owners.

## Payload

```json
{
  "owner": "user",
  "decision_basis": "User accepted the prototype after nine deterministic Rung 3 paths passed the non-compensatory hard-requirement filter.",
  "surface": [
    "capabilities()",
    "start(request_ref)",
    "resume(external_run_ref,input_ref)",
    "cancel(external_run_ref,reason_ref)",
    "events(external_run_ref,cursor)"
  ],
  "common_request": [
    "schema and adapter version/digest",
    "owner operation reference",
    "workspace revision",
    "ordered context and input pointers with digests",
    "interaction mode",
    "idempotency key and deadline where owner-declared"
  ],
  "common_outcome": [
    "running, waiting, succeeded, failed, or canceled",
    "none, committed, or ambiguous effect state",
    "external run reference and event cursor",
    "owner receipt, artifact, pending-action, diagnostic, and trace pointers"
  ],
  "matt_contract": "Matt request names a pinned skill and required artifact kinds; the host runs the skill; Matt adapter validates Matt-owned receipts without parsing workflow prose into harness state.",
  "ariadne_contract": "Ariadne request names a pinned preflight, graph, ingest, gate, invalidation, or handoff operation; Ariadne alone validates and mutates graph state and returns revision/event pointers.",
  "cancellation_contract": "cancel forwards intent only; canceled becomes terminal only on owner acknowledgment; ambiguous effects stop for owner inspection; the harness never infers rollback or compensation.",
  "handoff_contract": "Ariadne-to-Matt passes a substrate pointer; Matt-to-Ariadne passes an eligible receipted artifact through the existing ingest boundary; direct use may join later through pinned owner pointers and is never intercepted.",
  "error_contract": "unsupported capability and invalid pin fail before execution; invalid receipt and protocol error fail closed; human/approval/ambiguous-effect conditions wait; retry is permitted only from an owner replay declaration.",
  "ownership": {
    "harness": "attempt ID, opaque step, pins, pointers, event cursor, generic gates, cancellation intent",
    "matt_and_tracker": "skill procedure, interview/workflow meaning, issue and artifact state",
    "ariadne": "epistemic nodes, edges, provenance, invalidation, graph gates and writes",
    "host": "model/tool loop, session/process lifecycle, sandbox, permissions, native traces and physical cancellation",
    "method_contract": "normative method rules and completion predicates",
    "human": "answers, approvals, judgments and compensation authorization",
    "adapter": "translation, capability declaration, validation, normalization and conformance receipts only"
  },
  "direct_use": "Direct Matt and Ariadne invocation remains valid; importing a direct result starts or joins an attempt only from pinned owner receipt and artifact pointers.",
  "evidence": [
    "EVD-matt-ariadne-adapter-prototype-r3"
  ],
  "adversarial_critique": [
    "A shared vocabulary must not erase owner-specific semantics.",
    "Pointer-only storage must be enforced so the attempt ledger cannot become a second tracker or graph.",
    "Terminal cancellation without owner acknowledgment is unsafe.",
    "A pass-through adapter must be deleted if the Rung 6 thin baseline satisfies the same invariants."
  ],
  "unresolved_risks": [
    "real host invocation and cancellation compatibility",
    "structured Matt receipt availability",
    "Rung 6 adapter conformance"
  ],
  "reopen_condition": "A real boundary requires copied owner semantics, direct-use interception, cross-owner atomicity, inferred compensation, or fails the clean-session contract fixtures."
}
```
