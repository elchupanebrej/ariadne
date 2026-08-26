# 04 - Task: Rewrite skill contract for report and card links

Type: task
Status: resolved
Blocked by: 03

## Question

Bring the skill contract in line with the implemented reality: in `.agents/skills/ariadne/SKILL.md` replace the undefined "ASCII spiral" with a defined artifact — the decision tree and change log (DEC-RPT-13); in `rules/05-uncertainty.md` rewrite the links section: instead of banning per-card paths — mandatory links to `.ariadne/cards/<ID>.md` (gsd: `.planning/ariadne/cards/<ID>.md`) plus the agent's obligation to invoke `ariadne report` and embed its output in the answer (DEC-RPT-01). Check consistency with `rules/agent-rules.md` and depth-modes. Edit per `writing-for-agents`.

Blocked by ticket 03: the rules describe a working command, not a plan.

## Comments

- `SKILL.md`: "ASCII spiral" replaced by a defined artifact — the decision tree and change log from `ariadne report` (DEC-RPT-13).
- `rules/05-uncertainty.md`: the per-card-path ban rewritten into mandatory links `.ariadne/cards/<ID>.md` (gsd: `.planning/ariadne/cards/<ID>.md`) plus the obligation to run `ariadne report <FRAME-id>` and embed the output (DEC-RPT-01).
- Grep over `.agents/skills/ariadne/`: "spiral" — 0 hits; "per-card" — 0; remaining "report" occurrences (`10-frame.md`, `roles.md`) are the English verb, not command references. No contradictions in `agent-rules.md` or `depth-modes.md` — left unchanged.
- Reality check: `node dist/cli/index.js report FRAME-RPT-001 --json` ran against the live graph (`.ariadne/reports/001-frame-rpt-001.md`, 17 nodes reachable, change log 177/277); the generated report was deleted after the check as a reproducible artifact.
- `node dist/cli/index.js gate all --strict` — green.
