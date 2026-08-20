# 19 — Root skill and two-stage rule router (.agents/skills/ariadne/)

**What to build:** Compact root skill `.agents/skills/ariadne/SKILL.md` (< 300 tokens) with task triggers and a progressive disclosure router directing agents to specific operational rules.

**Blocked by:** 01 — Project scaffold and test infrastructure

**Status:** ready-for-agent

- [ ] Root `SKILL.md` is strictly under 300 tokens in length
- [ ] Contains semantic routing triggers for all 9 reasoning operations and epistemic governance
- [ ] Routes model requests to appropriate `rules/*.md` files without preloading entire rule set
