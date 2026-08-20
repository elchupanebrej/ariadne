---
name: ariadne
description: Model-invoked software reasoning for premature mechanisms, uncertain causes, contradictions, candidate architectures, evidence, invalidation, and risky transitions. Route each task branch to one targeted rule file.
---

# Ariadne

Apply matching branches in this numbered order. Load only the rule named by
the active branch:

1. Frame requirements apart from mechanisms: `rules/10-frame.md`.
2. Diagnose symptoms with falsifiable causal hypotheses: `rules/20-diagnose.md`.
3. Transform or trim a mechanism: `rules/30-transform.md`.
4. Explore structurally distinct candidates: `rules/40-explore.md`.
5. Resolve decision-significant unknowns: `rules/50-knowledge.md`.
6. Analyze change coupling: `rules/60-dependencies.md`.
7. Model queues, retries, and failure dynamics: `rules/70-dynamics.md`.
8. Select candidates against hard requirements: `rules/80-value.md`.
9. Validate claims or transitions: `rules/90-validate.md`.

For graph/provenance, evidence, invalidation, host roles, depth, or agent invariants, also load only the matching file: `rules/00-core.md`, `rules/evidence.md`, `rules/invalidation.md`, `rules/roles.md`, `rules/depth-modes.md`, or `rules/agent-rules.md`.

Load `80-value.md` or `90-validate.md` only after discriminating `EVD-*`
evidence exists. If it does not, use `rules/50-knowledge.md` first.
