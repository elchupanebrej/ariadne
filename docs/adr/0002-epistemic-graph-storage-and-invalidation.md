# 0002. Epistemic Graph Storage and Tiered Invalidation

## Context and Decision
Ariadne requires a robust epistemic state representation that survives context resets and agent boundaries without overwhelming LLM context windows or requiring a dedicated database daemon. 

We decided on:
1. **Hybrid Storage**: 
   - `STATE.yaml`: Active frontier, high-level summary, and unresolved epistemic nodes.
   - `GRAPH.jsonl`: Append-only event and edge log for full graph provenance and mutation history.
   - `INDEX.md`: Auto-generated, token-compact human and agent readable overview.
2. **Canonical English Prefixes**: Standardized prefixes (`CLM-`, `ASM-`, `HYP-`, `CTR-`, `UNK-`, `CAN-`, `EVDREQ-`, `EVD-`, `TRANS-`, `DEC-`).
3. **Tiered Transitive Invalidation**:
   - **Hard Gate**: Falsification of high-impact foundational assumptions or architectural hypotheses immediately sets downstream dependent candidates to `INVALIDATED` and halts ungrounded execution.
   - **Soft Gate**: Secondary or non-critical assumptions trigger `STALE` / `REQUIRES_REVALUATION` flags and generate an invalidation report without hard execution blocking.

## Consequences and Trade-offs
- Provides deterministic graph integrity and fast diffing for agents.
- Protects agents from continuing execution on invalidated architectural assumptions while avoiding unnecessary halts on minor peripheral changes.
