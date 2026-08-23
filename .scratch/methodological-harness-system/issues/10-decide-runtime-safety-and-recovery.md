# Decide runtime safety, observability, and recovery semantics

Type: grilling
Status: resolved
Blocked by: 03, 09
Parent: [Methodological Harness System](../map.md)

## Question

Which trust boundaries, permission rules, idempotency guarantees, cancellation semantics, retry limits, recovery receipts, observability signals, and escalation paths are hard requirements for the Orchestration Harness rather than responsibilities of Matt skills, Ariadne, or the host platform?

## Comments

- Grilling round 1: the user accepted the recommended trust root, approval boundary, zero-default replay policy, cancellation race rule, durable recovery fields, pointer-only observability envelope, and descriptive escalation contract.
- Grilling round 2: the user accepted atomic dispatch-intent concurrency, exact-duplicate/no-op event handling, fail-closed cursor and lifecycle violations, invocation-time deadline expiry, and owner-only ambiguous-effect resolution.
- The user confirmed the resulting contract as shared understanding.

## Answer

Use a **trusted-host, owner-gated, pointer-only safety boundary**. The harness records and validates generic orchestration facts; it never becomes the authority for host permissions, owner effects, workflow or epistemic meaning, rollback, compensation, telemetry operations, or human judgment.

### Trust and permission

- The host process and workspace are the v1 trusted computing base. Adapter events, artifacts, receipts, versions, and digests remain untrusted until their closed schemas, pins, bindings, and owner are validated.
- Cryptographic signatures are not a v1 requirement inside that trusted boundary. Require them only if a later host crosses an untrusted transport.
- An owner operation declares whether approval is required. The harness checks for an approval pointer bound to the attempt, operation, input digests, and expiry; the host revalidates and enforces the native permission at dispatch.
- Missing approval is `waiting`. Invalid, expired, mismatched, denied, or broadened authority is `failed` before dispatch. The harness never grants or extends authority.

### Dispatch, idempotency, and retry

- Atomically accept one dispatch intent against the current attempt revision before invoking an owner operation. A stale revision cannot dispatch, and a session that finds an existing intent must inspect the owner run rather than dispatch again.
- Replay defaults to **zero**. It requires an owner-issued, operation-specific replay declaration, stable idempotency key, finite pinned budget, deadline, no ambiguous effect, and at most one in-flight dispatch for the opaque step.
- The harness counts its own dispatch intents. Host-internal retries remain host-owned and must not weaken the owner's external receipt contract.
- A crash after intent but before outcome creates `waiting` for owner inspection; disappearance of the initiating session is never evidence that replay is safe.

### Events, cancellation, and recovery

- The same event cursor and digest is an idempotent no-op. A conflicting duplicate, cursor gap or regression, or event invalid for the current lifecycle state is a fail-closed protocol error.
- Cancellation is intent until an owner terminal receipt arrives. Physical cancellation belongs to the host. A late committed success remains `succeeded` with cancellation intent retained; `canceled` requires owner acknowledgment; an ambiguous effect remains `waiting`. Cancellation never implies rollback.
- Only an owner effect receipt declaring `committed` or `no_effect` resolves ambiguity. `no_effect` may allow replay only under a fresh declaration and remaining budget. Compensation is a separately authorized owner operation linked to immutable prior history.
- Persist dispatch intent before dispatch and every accepted transition afterward. Recovery state contains only attempt and opaque-step references, revision and pins, lifecycle and effect state, attempt count, replay budget and deadline, cursor, and owner receipt/artifact/pending-action/diagnostic/trace pointers. Corrupt or conflicting state fails closed.
- No scheduler is required. Evaluate deadlines on invocation or resume: a pending action is `waiting` before expiry and `failed` after expiry, requiring a new authorized attempt.

### Observability and escalation

- Emit pointer-only events for lifecycle transitions, dispatch intent/result, gate rejection, retry, cancellation, recovery, and escalation. Include correlation identifiers, sequence and owner cursor, timestamps, adapter and owner, disposition and effect state, and diagnostic/trace pointers.
- Never store owner payloads, secrets, or copied workflow or epistemic state. The host owns collection, retention, export, alerts, native traces, external-diagnostic redaction, tail metrics, and SLOs.
- Every `waiting` or `failed` result names a stable reason code, authority pointer, evidence pointers, pending action, resume predicate, and optional deadline. The harness describes the escalation; the Method Contract, owner, host, or human authority decides and performs routing.
- The harness has no internal work queue, retry daemon, scheduler, database, distributed transaction coordinator, rollback engine, compensation engine, or alert router.

### Evidence boundary

This is a provisional contract decision supported structurally and by the existing Rung 3 adapter prototype. “Decide clean-session verification and evaluation” must require real boundary conformance and Rung 8 crash/concurrency fault injection. Reopen the contract if real adapters cannot provide bound approvals, stable cursors/digests, owner effect receipts, replay declarations, or cancellation acknowledgment without copied semantics; if fault injection violates an invariant; or if an untrusted transport changes the trust root.

### Ariadne context

- [`DEC-runtime-safety-recovery-contract`](../../../.ariadne/GRAPH.jsonl) records the accepted contract.
- [`DYN-owner-gated-recovery-loop`](../../../.ariadne/GRAPH.jsonl) records bounded retry and failure dynamics.
- [`VAL-SELECT-runtime-safety-recovery`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate filter and adversarial critique.
- [`EVDREQ-runtime-safety-recovery-r8`](../../../.ariadne/GRAPH.jsonl) records the downstream fault-injection obligation.
