# 0008. Epistemic Depth Mode Orthogonality and Transition Decommissioning Contracts

## Context and Decision
Ariadne must reconcile the three Epistemic Depth Modes (Fast, Standard, Deep) from the Nine Operations methodology with diverse host environments (Modes A, B, C, D) and prevent the accumulation of permanent architectural debt from temporary transition shims.

We decided to:
1. **Strictly Orthogonalize Depth Modes and Deployment Modes**:
   - Deployment Modes (A: GSD+Matt+Ariadne, B: GSD+Ariadne, C: Matt+Ariadne, D: Standalone) define tool capability and file-system projection.
   - Depth Modes (Fast, Standard, Deep) define required epistemic completeness, candidate mechanism counts, and adversarial critique gates.
   - Any Deployment Mode can run under any Depth Mode via runtime flag or `STATE.yaml` setting.
2. **Ephemeral Role Dispatch for Deep Mode**:
   - Standard operations execute inline via dynamically loaded `rules/*.md` rules.
   - Deep mode adversarial critique and empirical spikes instantiate ephemeral worker subagents that return structured epistemic mutations without registering persistent tools.
3. **Mandatory Decommissioning Contracts for Transition Systems**:
   - Every `TRANS-*` node must specify a permanent target candidate, a falsifiable retirement condition, an expiration deadline, and an executable cleanup verification test.
   - Quality gates reject closing phases or merging code if a temporary transition mechanism lacks an automated cleanup check.

## Consequences and Trade-offs
- Provides maximum flexibility: developers can execute rapid, lightweight changes (Fast mode) in full GSD environments, or run exhaustive architectural explorations (Deep mode) in standalone workspaces.
- Eliminates "temporary" tech debt by enforcing active lifecycle tracking on transition shims.
