# 11 — Semantic quality gate

**What to build:** Deterministic semantic gate enforcing operation-specific domain rules (e.g. hypothesis falsifiability, separation diversity >= 3 for contradictions, and non-compensatory scoring for requirements).

**Blocked by:** 07 — Graph topological integrity and DAG validation

**Status:** ready-for-agent

- [ ] Enforces that active technical contradictions (`CTR-*`) have >= 3 candidate mechanisms spanning distinct separation principles
- [ ] Rejects compensatory weighted scoring when a hard requirement fails
- [ ] Asserts that `diagnose` hypotheses define explicit falsification predicates
