# DEC-runtime-safety-recovery-contract: Owner-gated runtime safety and recovery contract

- Status: PROVISIONAL
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-09-07

## Statement

Require a trusted-host, owner-gated, pointer-only orchestration safety boundary: persist one atomic dispatch intent per current attempt revision, default replay to zero, advance only on validated owner receipts, and fail closed or wait at every unauthorized, conflicting, expired, canceled, or ambiguous boundary.

## Payload

```json
{
  "dependencies": [
    "DEC-minimum-orchestration-contract",
    "DEC-matt-ariadne-adapter-contract",
    "DYN-owner-gated-recovery-loop",
    "VAL-SELECT-runtime-safety-recovery"
  ],
  "owner": "user via confirmed Wayfinder grilling",
  "candidate": "CAN-owner-gated-runtime-safety",
  "selection": "VAL-SELECT-runtime-safety-recovery",
  "trust_contract": {
    "trusted": "host process and workspace are the v1 computing base",
    "untrusted_until_validated": [
      "adapter events",
      "artifact and receipt pointers",
      "version and digest claims"
    ],
    "validation": [
      "closed schema",
      "owner and adapter version pin",
      "workspace and input digest",
      "attempt, operation, and expiry binding"
    ],
    "cryptography": "not mandatory until a boundary crosses an untrusted transport"
  },
  "permission_contract": {
    "owner": "the owner operation declares whether approval is required; the host revalidates and enforces native permission at dispatch",
    "harness": "requires the bound approval pointer and never grants, widens, or substitutes authority",
    "missing": "waiting with a pending-action pointer",
    "invalid_expired_mismatched_denied": "failed before dispatch"
  },
  "idempotency_contract": {
    "default_replay_budget": 0,
    "replay_requirements": [
      "owner-issued operation-specific replay declaration",
      "stable idempotency key",
      "finite pinned budget",
      "deadline",
      "no ambiguous effect",
      "one in-flight dispatch per opaque step"
    ],
    "counting_boundary": "the harness counts its own dispatch intents; host-internal behavior remains host-owned"
  },
  "dispatch_contract": {
    "atomicity": "compare-and-append one dispatch intent against the current attempt revision before invocation",
    "concurrency": "a stale revision cannot dispatch; a session finding an existing intent must inspect the owner run",
    "crash_gap": "missing outcome after intent is ambiguous waiting, never evidence for replay"
  },
  "event_contract": {
    "exact_duplicate": "same cursor and digest is a no-op",
    "protocol_error": [
      "conflicting duplicate",
      "cursor gap or regression",
      "event invalid for current lifecycle state"
    ],
    "protocol_error_disposition": "failed closed"
  },
  "cancellation_contract": {
    "physical_owner": "host",
    "intent": "nonterminal until owner receipt",
    "late_committed_success": "succeeded with cancellation intent retained",
    "terminal_canceled": "requires owner acknowledgment",
    "ambiguous": "waiting for owner inspection",
    "rollback": "never inferred"
  },
  "recovery_contract": {
    "durable_before_dispatch": "dispatch intent",
    "accepted_transition_fields": [
      "attempt and opaque step references",
      "revision and pins",
      "lifecycle and owner effect state",
      "attempt count, replay budget, and deadline",
      "event cursor",
      "owner receipt, artifact, pending-action, diagnostic, and trace pointers"
    ],
    "corrupt_or_conflicting_state": "failed closed",
    "ambiguous_resolution": "only an owner receipt declaring committed or no_effect",
    "no_effect_replay": "requires a fresh owner declaration and remaining budget",
    "compensation": "a separately authorized owner operation linked to immutable prior history"
  },
  "deadline_contract": "No scheduler is required. Evaluate on invocation or resume; waiting remains waiting before expiry and becomes failed after expiry, requiring a new authorized attempt.",
  "observability_contract": {
    "events": [
      "lifecycle transition",
      "dispatch intent and result",
      "gate rejection",
      "retry",
      "cancellation",
      "recovery",
      "escalation"
    ],
    "fields": [
      "attempt and step correlation",
      "sequence and owner cursor",
      "timestamps",
      "adapter and owner",
      "disposition and effect state",
      "diagnostic and trace pointers"
    ],
    "forbidden": [
      "owner payloads",
      "secrets",
      "copied workflow or epistemic state"
    ],
    "host_owned": [
      "collection",
      "retention",
      "export",
      "alerts",
      "native traces",
      "redaction of external diagnostics",
      "p95 and p99 metrics",
      "SLOs"
    ]
  },
  "escalation_contract": {
    "harness": "describes but does not route or answer",
    "required_fields": [
      "stable reason code",
      "authority pointer",
      "evidence pointers",
      "pending action",
      "resume predicate",
      "optional deadline"
    ],
    "policy_owners": [
      "Method Contract",
      "operation owner",
      "host",
      "human authority"
    ]
  },
  "completion_states": [
    "succeeded",
    "waiting",
    "failed",
    "canceled"
  ],
  "evidence": [
    "EVD-matt-ariadne-adapter-prototype-r3"
  ],
  "required_evidence": [],
  "unresolved_risks": [
    "real host approval and cancellation conformance",
    "crash and concurrent-resumer safety",
    "structured owner effect receipt availability",
    "physical ledger and atomicity substrate",
    "runtime layer remains deletable if a thinner implementation passes"
  ],
  "adversarial_critique": [
    {
      "attack": "The attempt record can become a second workflow tracker.",
      "response": "Its closed schema permits only lifecycle metadata and owner pointers; owner payload parsing is prohibited."
    },
    {
      "attack": "Schema and digest validation cannot make a malicious host safe.",
      "response": "The host and workspace are explicitly the v1 trust root; untrusted transport requires reopening cryptographic requirements."
    },
    {
      "attack": "Zero default replay reduces availability.",
      "response": "Availability cannot compensate for duplicate-effect safety; owners can issue finite declarations for safe operations."
    },
    {
      "attack": "Atomic intent cannot reveal whether a crashed external effect committed.",
      "response": "The contract preserves ambiguity and requires owner inspection instead of pretending atomicity across boundaries."
    },
    {
      "attack": "Failing expired waiting attempts may discard progress.",
      "response": "Immutable history remains importable; only continued authority expires and a new authorized attempt is required."
    },
    {
      "attack": "This boundary may be unnecessary runtime code.",
      "response": "The implementation must be deleted or inlined if a host-native thin baseline satisfies every invariant."
    }
  ],
  "reopen_condition": "Reopen if a real adapter cannot express bound approval, stable cursor and digest, owner effect state, replay declaration, or terminal cancellation without copied semantics; if fault injection violates a hard invariant; or if an untrusted transport requires cryptographic attestation."
}
```
