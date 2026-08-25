---
name: ariadne
description: Model-invoked reasoning for decision-significant uncertainty, ambiguous requirements, unknown facts, contradictions, candidate mechanisms, evidence, invalidation, and risky transitions. Prepare an epistemic substrate for downstream skills and route each branch to one rule file.
---

# Ariadne

Route each task branch in order; load only the matching rule:

0. Decision-significant uncertainty or ambiguity: `rules/05-uncertainty.md`.
1. Requirements apart from mechanisms: `rules/10-frame.md`.
2. Symptoms and falsifiable causal hypotheses: `rules/20-diagnose.md`.
3. Transform or trim a mechanism: `rules/30-transform.md`.
4. Structurally distinct candidates: `rules/40-explore.md`.
5. Decision-significant unknowns: `rules/50-knowledge.md`.
6. Change coupling: `rules/60-dependencies.md`.
7. Queues, retries, and failure dynamics: `rules/70-dynamics.md`.
8. Candidate selection against hard requirements: `rules/80-value.md`.
9. Claim or transition validation: `rules/90-validate.md`.

For graph/provenance, evidence, invalidation, host roles, depth, or agent
invariants, load only the matching `rules/00-core.md`, `rules/evidence.md`,
`rules/invalidation.md`, `rules/roles.md`, `rules/depth-modes.md`, or
`rules/agent-rules.md`. Load value/validation only after discriminating
evidence; otherwise use knowledge first.

Artifact operations must embed the decision tree and change log produced by
`ariadne report`, plus the actual-file Markdown links required by
`rules/05-uncertainty.md`; never expose a bare card ID as a document.
