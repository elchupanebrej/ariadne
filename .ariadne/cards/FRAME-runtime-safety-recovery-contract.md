# FRAME-runtime-safety-recovery-contract: Runtime safety and recovery boundary

- Status: ACTIVE
- Provenance: PROPOSED
- Type: FRAME
- Revised: 2026-09-07

## Statement

A fresh session must safely continue a pinned orchestration attempt from repository-visible receipts without treating the Orchestration Harness as the authority for host permissions or owner effects.

## Payload

```json
{
  "context": "A host-neutral attempt crosses the harness, a host process, owner-approved Matt or Ariadne adapters, human approval boundaries, and repository-visible receipts; crashes, duplicate delivery, timeout, cancellation, and ambiguous external effects are possible.",
  "required_behavior": "Given pinned attempt state and untrusted external lifecycle events, accept only authorized, schema-valid, replay-safe transitions; preserve enough owner pointers to determine or escalate the effect; and stop without inferred replay, rollback, compensation, or human input when authority or effect state is unresolved.",
  "proposed_mechanism": "A minimal Orchestration Harness kernel with a pointer-only attempt journal and owner-adapter gates; this remains a proposed mechanism subject to the clean-session deletion test.",
  "preconditions": [
    "Method Contract, adapter, workspace, and input versions are pinned",
    "the adapter declares capabilities and owner receipt schemas",
    "prior attempt state is absent or schema-valid and digest-consistent"
  ],
  "postconditions": [
    "exactly one accepted lifecycle disposition is repository-visible",
    "accepted effects are supported by owner receipts or remain explicitly ambiguous",
    "a fresh session can resume, inspect, or escalate without hidden memory"
  ],
  "invariants": [
    "the host alone enforces sandbox and native permissions",
    "owners alone declare effect, replay, rollback, and compensation meaning",
    "the harness never stores copied workflow or epistemic payloads",
    "ambiguous effects are never automatically replayed",
    "terminal cancellation requires an owner terminal receipt",
    "secrets and raw payloads do not enter the attempt journal"
  ],
  "constraints": [
    "no database, queue, scheduler, or distributed transaction coordinator",
    "no global throughput or availability claim",
    "only pointers, pins, generic lifecycle metadata, and generic gates are harness-owned",
    "implementation remains out of scope for this Wayfinder ticket"
  ],
  "behavioral_delta": "The minimum contract and adapter contract establish ownership and fail-closed intent, but do not yet fix exact authorization evidence, retry budgets, recovery journal contents, observable transition signals, or escalation dispositions.",
  "perspectives": {
    "human": "retains approval, judgment, and compensation authority",
    "host": "enforces permissions and physical process cancellation",
    "owner": "defines semantic receipts and replay safety",
    "operator": "needs deterministic correlation and an explicit recovery disposition",
    "adversary": "must not gain authority by editing an unvalidated pointer or replaying a stale receipt",
    "maintainer": "needs one small host-neutral contract with no owner payload parsing"
  },
  "success_observer": "A clean-session conformance fixture can determine the only safe next disposition from persisted pins, cursors, and owner pointers.",
  "falsification_test": "A fixture succeeds after an expired or mismatched approval, dispatches more than the declared replay budget, reports cancellation without owner acknowledgment, loses an accepted owner receipt after restart, emits secret payload data, or advances an ambiguous effect."
}
```
