# Operation 90: Validate

## Trigger and purpose

Use Validate when a Candidate Mechanism needs executable proof or when a
stateful migration has transition risk. Validate treats proof and the path from
current state to target state as distinct engineering objects.

## Claim validation

1. List the claim, claim class, required invariant, and falsification result.
2. Select the minimum Evidentiary Ladder rung from `rules/evidence.md`.
3. Execute the check at that boundary. Record command, environment, metrics,
   receipt, and verdict in `VAL-*` and `EVD-*` records.
4. Reject evidence that is below the rung or from the wrong claim class. Unit
   tests do not prove Throughput & Latency, Distributed safety, or Migration
   safety.
5. Re-run structural, semantic, and epistemic gates. A supported result MAY
   promote provenance only to the level it proves; a falsifying result starts
   Transitive Invalidation.

## Transition Architecture

A `TRANS-*` node MUST define:

- `target_mechanism_ref`: the permanent Candidate Mechanism;
- `retirement_predicate`: an executable condition for removal;
- `expiration_deadline`: an owner-visible deadline;
- `cleanup_verification_test`: a runnable check proving cleanup.

The lifecycle is strict:

`PROPOSED -> EXPANDED -> DUAL_RUNNING -> MIGRATING -> CONTRACTED -> RETIRED`.

| State | Required gate |
| --- | --- |
| `PROPOSED` | Current and target mechanisms, owner, risk, and target evidence |
| `EXPANDED` | New schema or contract accepts legacy and target formats |
| `DUAL_RUNNING` | Dual-write, shadow, or parallel path has parity checks |
| `MIGRATING` | Backfill, reconcile, and read-switch receipts exist |
| `CONTRACTED` | Legacy writes and compatibility paths are disabled safely |
| `RETIRED` | Retirement predicate and cleanup verification test pass |

The v5 Technique 9.3 rollout phases (expand, backfill/reconcile, switch read,
contract, and rollback) are execution details inside these lifecycle states.
They MUST NOT replace the six-state lifecycle. A big-bang cutover or an
irreversible schema drop before verification is invalid.

## Transition receipts

Validate MUST record compatibility, dual-running parity, rollback trigger,
traffic or workload scope, telemetry, and decommissioning receipt. A temporary
mechanism MUST have an owner and review deadline. An expired or unverified
`TRANS-*` MUST block the quality gate and emit an Operational Notice.

## Example and gate

Positive: an expanded schema accepts both versions; a dual-write run reconciles
records; a shadow comparison meets its predicate; reads switch; old writes are
contracted; the cleanup test removes the shim and passes.

Negative: “The new schema passed a staging smoke test, so drop the old column.”
This does not prove Migration safety and has no rollback or cleanup receipt.

The Validate Gate MUST reject a transition without all four mandatory fields,
the next lifecycle predicate, and evidence matched to each claim class.
