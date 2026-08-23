# 11 — Semantic quality gate

**What to build:** Deterministic semantic gate enforcing operation-specific domain rules (e.g. hypothesis falsifiability, separation diversity >= 3 for contradictions, and non-compensatory scoring for requirements).

**Blocked by:** 07 — Graph topological integrity and DAG validation

**Status:** resolved

- [ ] Enforces that active technical contradictions (`CTR-*`) have >= 3 candidate mechanisms spanning distinct separation principles
- [ ] Rejects compensatory weighted scoring when a hard requirement fails
- [ ] Asserts that `diagnose` hypotheses define explicit falsification predicates

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: Semantic gate enforces >=3 candidates/principles; Fast-mode relaxation to 1 is deliberate depth-modes governance (rules/depth-modes.md), tested at gates/structural-semantic.test.ts. Full suite green (53 files / 557+ tests), typecheck clean.
