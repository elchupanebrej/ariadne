# 0010. Operational Notice Signaling, Transition Lifecycle, and Separation Diversity

## Context and Decision
Ariadne must signal external orchestrators (such as GSD) upon assumption falsification without violating zero-shadow state, govern the full lifecycle of temporary transition mechanisms, and guarantee candidate exploration breadth when addressing contradictions.

We decided to:
1. **Tri-Channel Operational Notice Signaling in GSD Mode**:
   - Persist structured invalidation notices (`NOT-*`) to `.planning/ariadne/NOTICES.jsonl`.
   - Maintain active notice references in `STATE.yaml` (`active_notices: [NOT-*]`) to inform subsequent GSD planning/execution turns.
   - Emit high-visibility terminal banners (`⚠️ ARIADNE OPERATIONAL NOTICE`) without mutating GSD's historical phase records (`.planning/phases/*/SUMMARY.md`).
2. **6-State Invariant Transition Lifecycle (`TRANS-*`)**:
   - Enforce the explicit lifecycle: $\text{PROPOSED} \to \text{EXPANDED} \to \text{DUAL\_RUNNING} \to \text{MIGRATING} \to \text{CONTRACTED} \to \text{RETIRED}$.
   - Require every `TRANS-*` node to declare target candidate references, a retirement predicate, an expiration deadline, and an executable cleanup verification test.
   - Fail epistemic quality gates if transition mechanisms expire or remain active without cleanup verification.
3. **Mandatory Multi-Principle Candidate Generation**:
   - For any active `CTR-*` contradiction in Standard or Deep mode, require $\ge 3$ distinct `CandidateMechanism` (`CAN-*`) nodes spanning different Separation Principles (Time, State/Space, Condition, Parts vs. Whole).
   - Prohibit premature decision locking (`DEC-*`) if the candidate pool consists only of single-principle variations.

## Consequences and Trade-offs
- Preserves external operational history while ensuring that invalidation signals are never dropped.
- Eliminates the risk of temporary shims becoming permanent technical debt.
- Prevents premature design convergence and weak compromises when architectural contradictions are identified.
