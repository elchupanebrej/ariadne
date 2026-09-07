# DYN-owner-gated-recovery-loop: Bounded orchestration recovery dynamics

- Status: ACTIVE
- Provenance: DECIDED
- Type: DYN
- Revised: 2026-08-24

## Statement

The harness prevents retry feedback and duplicate side effects by recording one atomic dispatch intent per current attempt revision, defaulting replay budget to zero, and stopping every ambiguous, conflicting, expired, or unauthorized path.

## Payload

```json
{
  "owner": "user via confirmed Wayfinder grilling",
  "workload": {
    "arrival_profile": "At most one valid next owner operation per orchestration attempt; hosts may redeliver lifecycle events or restart sessions at any point.",
    "service_capacity": "No harness queue or worker pool is specified; owner and host capacity remain external.",
    "time_horizon": "One pinned attempt from creation to succeeded, waiting, failed, or canceled."
  },
  "stocks": {
    "nonterminal_attempt": "one pointer-only record per attempt",
    "inflight_dispatch": "zero or one per opaque step",
    "replay_tokens": "finite owner-declared budget, zero by default",
    "unresolved_effect": "zero or one ambiguous owner operation that blocks further dispatch"
  },
  "flows": {
    "in": "atomic dispatch intent, owner lifecycle event, human or approval pointer, cancellation intent",
    "out": "validated transition to running, waiting, succeeded, failed, or canceled"
  },
  "rates": {
    "lambda": "host-owned invocation and event arrival rate; no throughput claim",
    "mu": "owner-adapter service rate; no harness capacity claim",
    "rho": "not applicable because the contract forbids an internal queue"
  },
  "queue_limits": "No internal retry or work queue; one accepted in-flight dispatch per step.",
  "tail_metrics": "Every boundary event carries timestamps and trace pointers, but p95, p99, alerting, and SLOs are host observability responsibilities.",
  "feedback_loops": [
    "timeout to replay is broken by zero default budget and owner replay declaration",
    "session crash to duplicate dispatch is broken by persisted intent and attempt-revision compare-and-append",
    "cancel to assumed rollback is broken by owner terminal receipt",
    "ambiguous effect to compensation is broken by a separate human-authorized owner operation"
  ],
  "failure_modes": [
    "crash after persisted intent but before receipt becomes owner inspection, not replay",
    "exact duplicate cursor and digest is a no-op",
    "conflicting duplicate, cursor gap, regression, or invalid lifecycle transition fails as protocol error",
    "expired waiting state becomes failed when next evaluated",
    "committed success after cancellation remains succeeded with cancellation intent recorded"
  ],
  "version_skew": "Schema, adapter, workspace, Method Contract, and input pin mismatch fails before dispatch.",
  "operating_conditions": [
    "trusted host process and workspace",
    "untrusted adapter events and referenced artifacts until validation",
    "no autonomous scheduler or background retry loop"
  ],
  "backpressure": "Fail closed or wait at the named authority; never accumulate internal queued work.",
  "recovery_predicates": [
    "Only an owner effect receipt declaring committed or no_effect resolves ambiguity",
    "no_effect requires a fresh replay declaration and remaining finite budget before redispatch",
    "terminal canceled requires owner acknowledgment",
    "a new session may inspect a persisted intent but may not redispatch solely because the prior session vanished"
  ],
  "falsification_thresholds": [
    "more than one dispatch intent accepted for the same attempt revision and step",
    "any replay with zero or exhausted budget",
    "any ambiguous effect automatically replayed or compensated",
    "any conflicting or gapped event advances lifecycle",
    "any terminal cancellation lacks owner acknowledgment"
  ]
}
```
