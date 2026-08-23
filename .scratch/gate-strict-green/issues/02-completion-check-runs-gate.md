# 02 — Completion check exercises the real gate

**What to build:** The teach-ariadne skill's documented runnable completion check does what it claims: after the parser assertions pass, the strict Ariadne gate actually validates the *example's* graph through the built CLI. Today the documented command (`node example/check.mjs && ariadne gate all --strict`) runs the asserts but then gates whatever directory you happen to stand in — never the example. After this ticket, one command from the repo root runs both steps against the right targets and passes when the example is green.

**Blocked by:** 01 — Example graph speaks the CLI schema

**Status:** ready-for-agent

- [ ] A single documented command, run from the repo root, executes the parser checks and then the strict gate on the example graph
- [ ] The command fails (nonzero exit) if either step fails
- [ ] The teach-ariadne skill doc's Runnable Completion Check section matches the working command exactly
- [ ] No stale assumptions about cwd or a globally installed `ariadne` binary remain in that section

## Comments

Done. `check.mjs` now spawns the built CLI (`gate all --strict`, cwd = example dir) as its final step and fails hard on nonzero exit; SKILL.md's Runnable Completion Check section documents `npm run build && node .agents/skills/teach-ariadne/example/check.mjs` from the repo root. Verified exit 0 end to end.
