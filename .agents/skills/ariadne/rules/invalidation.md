# Transitive Invalidation

## Trigger

When an `EVD-*` result with `MEASURED` or `FACT` provenance falsifies an
`ASM-*` or `HYP-*` node, the engine MUST record the target as `FALSIFIED`.
The engine MUST preserve the old node and append an invalidation event.

## Cascade

The engine MUST traverse the reverse topology once across `depends_on`,
`derived_from`, and `supports` edges. The traversal MUST be deterministic and
linear in the graph size: `O(V + E)`.

For each reachable node:

- A `CLM-*` Claim MUST become `NEEDS_REVIEW`.
- A `CAN-*` Candidate Mechanism MUST become `INVALIDATED` or `NEEDS_REVIEW`.
- A `DEC-*` Decision MUST become `RE-OPENED` and `NEEDS_REVIEW`.
- A `TRANS-*` Transition Architecture MUST become `BLOCKED`.

The cascade MUST not delete nodes, rewrite historical events, or silently
continue work that depends on an invalidated Candidate. Re-running the same
falsification MUST be idempotent apart from a new audit event.

## Operational Notice

In GSD mode, Ariadne MUST emit a structured `NOT-*` Operational Notice. It
MUST append the notice to `.planning/ariadne/NOTICES.jsonl`, add its ID to
`active_notices` in `.planning/ariadne/STATE.yaml`, and print the banner
`⚠️ ARIADNE OPERATIONAL NOTICE`. It MUST NOT mutate completed GSD phase
`SUMMARY.md` records.

In Standalone mode, the notice MUST be persisted under `.ariadne/NOTICES.jsonl`
and referenced by the standalone `STATE.yaml`. A notice MUST state the
falsified node, evidence ID, affected nodes, owner or next action, and the
required revaluation condition.

## Execution stop

An active execution branch MUST stop when its Candidate Mechanism is
`INVALIDATED`. Deep mode MAY emit `SIG_ABORT` to the host. The host MUST route
the notice to a human or operational planner; Ariadne MUST not rewrite the
external delivery history.
