# 19 — Root skill and two-stage rule router (.agents/skills/ariadne/)

**What to build:** Compact root skill `.agents/skills/ariadne/SKILL.md` (< 300 tokens) with task triggers and a progressive disclosure router directing agents to specific operational rules.

**Blocked by:** 01 — Project scaffold and test infrastructure

**Status:** resolved

- [ ] Root `SKILL.md` is strictly under 300 tokens in length
- [ ] Contains semantic routing triggers for all 9 reasoning operations and epistemic governance
- [ ] Routes model requests to appropriate `rules/*.md` files without preloading entire rule set

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: SKILL.md two-stage router (<300 words) routing 9 operations + governance files; root-skill-router test. Full suite green (53 files / 557+ tests), typecheck clean.
