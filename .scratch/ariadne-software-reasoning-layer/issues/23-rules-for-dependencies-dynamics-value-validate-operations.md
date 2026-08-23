# 23 — Rules for dependencies, dynamics, value, validate operations (60, 70, 80, 90)

**What to build:** Rule specifications for Operation 60 (Dependencies: coupling analysis), Operation 70 (Dynamics: queues, retries, metastable failures), Operation 80 (Value: non-compensatory filtering), and Operation 90 (Validate: transition architecture lifecycle).

**Blocked by:** 20 — Core rules and epistemic governance (00-core, evidence, invalidation, roles, depth-modes, agent-rules)

**Status:** resolved

- [ ] `rules/60-dependencies.md` defines change radius analysis across schema, deployment, and event coupling
- [ ] `rules/70-dynamics.md` defines system dynamics modeling under load, queue buildup, and retry storms
- [ ] `rules/80-value.md` and `rules/90-validate.md` detail non-compensatory scoring and 6-stage transition architecture lifecycle

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: rules/60-dependencies.md change radius; rules/70-dynamics.md queues/retries/load; rules/80-value.md non-compensatory scoring; rules/90-validate.md six-state lifecycle; system-rules tests. Full suite green (53 files / 557+ tests), typecheck clean.
