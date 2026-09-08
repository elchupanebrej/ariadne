# Decide the persistence transaction and recovery contract

Type: grilling
Status: resolved
Blocked by: 02
Parent: [Ariadne production readiness](../map.md)

## Question

What single persistence module interface should own `GRAPH.jsonl`, `STATE.yaml`, cards, indexes, notices, and orchestration-attempt ledgers for the supported multi-process local-filesystem model? Decide the authoritative record, commit point, lock ownership and expiry rules, idempotency semantics, treatment of derived projections, recovery behavior for incomplete tails versus committed-history corruption, and the caller-visible result when projection work fails after the authoritative event is committed.

The answer must be strong enough to reject the reproduced data-loss, invalid-cycle, silent-state-replacement, and committed-but-reported-failed scenarios while avoiding a database or network coordination layer.

## Answer

Adopt one deep persistence interface as the only public write and recovery seam. It owns graph records, notices, projections, and orchestration-attempt ledgers while keeping their authorities separate:

- `GRAPH.jsonl` is the canonical graph history. Each logical graph mutation is one validated, recoverable framed record containing a stable idempotency key and payload digest.
- `NOTICES.jsonl` is the canonical operational-notice history for the configured adapter root. Active-notice fields in `STATE.yaml` are projections of that history.
- `.orchestration/attempts/<id>.jsonl` is the canonical pointer-only history for one Orchestration Attempt. Attempt state is not stored as Ariadne graph nodes and remains independently addressable.
- `STATE.yaml`, `INDEX.md`, and `cards/` are derived projections. Valid adapter-owned overlay fields in state are preserved; projections never replace canonical history.

Graph, state, notices, index, cards, and repair reads share one root lock. Independent orchestration attempts use one lock per attempt. Lock metadata contains a schema version, PID, random ownership token, and timestamps. Lock age is diagnostic only: automatic recovery is allowed only when the recorded owner PID is definitely absent. Ownerless, malformed, live, reused, permission-denied, or otherwise uncertain locks fail closed; timeout never transfers ownership. Normal release verifies the ownership token.

Every canonical mutation runs under its lock: read and schema-validate the current canonical history, compute and validate the prospective state, append one framed record, and call `FileHandle.sync()`. Successful sync is the commit point. Temp-file replacement and supported containing-directory sync are used for projections, but no cross-file atomic commit or universal power-loss guarantee is promised.

Mutations carry a stable idempotency key and payload digest. A retry with the same key and digest returns the previously committed result without appending again; the same key with different content fails with an idempotency conflict. A missing or ambiguous outcome is never blindly replayed. The persistence result is explicit: `not_committed` for failures before the canonical write, `commit_unknown` when write or sync completion cannot be established, `committed` when canonical history and projections are current, and `committed_with_recovery_needed` when canonical history is synced but projection work fails. The latter two outcomes never cause rollback or an automatic duplicate append.

Recovery accepts only a demonstrably incomplete final frame and may truncate or quarantine only that tail while retaining diagnostic evidence. Corruption, schema failure, revision gaps, or invariant violations before the final frame fail closed and never truncate valid later history. A missing projection may be rebuilt from valid canonical records; invalid or suspicious state is not silently replaced. Cross-ledger operations do not claim one atomic transaction: they use correlation pointers and documented ordering. In particular, an Orchestration Harness dispatch intent is durable before owner invocation, and projection or notice failure cannot erase it.
