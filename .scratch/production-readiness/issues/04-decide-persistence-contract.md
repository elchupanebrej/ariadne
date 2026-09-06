# Decide the persistence transaction and recovery contract

Type: grilling
Blocked by: 02
Parent: [Ariadne production readiness](../map.md)

## Question

What single persistence module interface should own `GRAPH.jsonl`, `STATE.yaml`, cards, indexes, notices, and orchestration-attempt ledgers for the supported multi-process local-filesystem model? Decide the authoritative record, commit point, lock ownership and expiry rules, idempotency semantics, treatment of derived projections, recovery behavior for incomplete tails versus committed-history corruption, and the caller-visible result when projection work fails after the authoritative event is committed.

The answer must be strong enough to reject the reproduced data-loss, invalid-cycle, silent-state-replacement, and committed-but-reported-failed scenarios while avoiding a database or network coordination layer.
