# 21 — Rules for frame and diagnose operations (10-frame.md, 20-diagnose.md)

**What to build:** Detailed rule specifications for Operation 10 (Frame: separating required behavior from proposed mechanism) and Operation 20 (Diagnose: generating falsifiable causal hypotheses).

**Blocked by:** 20 — Core rules and epistemic governance (00-core, evidence, invalidation, roles, depth-modes, agent-rules)

**Status:** resolved

- [ ] `rules/10-frame.md` defines behavior vs mechanism separation operators and `FRAME-` card schema
- [ ] `rules/20-diagnose.md` defines causal hypothesis generation, differential diagnosis, and `HYP-` card schema
- [ ] Includes concrete positive and negative examples for agent alignment

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: rules/10-frame.md behavior-vs-mechanism + FRAME schema; rules/20-diagnose.md differential/HYP schema with positive+negative examples. Full suite green (53 files / 557+ tests), typecheck clean.
