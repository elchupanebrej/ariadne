# skills.sh mechanics

Type: research
Status: resolved

## Question

Facts about the skills.sh ecosystem / `npx skills` CLI:

1. How does `npx skills add owner/repo@skill` discover skills in a repository: what directory layout is expected, do multi-skill repos work, is any metadata needed beyond SKILL.md frontmatter?
2. Where does the CLI place files for each supported agent (Claude Code, opencode, …) — the full list of agents and paths; does it ever write to `.agents/skills`?
3. Versioning and updates: how does `npx skills update` work, where does a skill's version come from, what does the user see on the skill's page at skills.sh?
4. Requirements for repo visibility and listing on skills.sh: how does a skill get into the catalog (automatically after first install? is registration needed?)

Answer with facts and links to skills.sh docs / vercel-labs/skills.

## Answer

Skills for skills.sh are simply directories containing a `SKILL.md` (frontmatter: `name` + `description`, nothing else); multi-skill repos are the norm. Full findings: [docs/research/skills-sh-mechanics.md](../../../docs/research/skills-sh-mechanics.md) (branch `research/skills-sh-mechanics`).

1. **Layout**: scanned containers are the repo root, `skills/`, and ~60 `.agent/skills/` directories; depth ≤3 (`skills/<cat>/<name>/SKILL.md` works); no metadata beyond frontmatter required.
2. **Install paths**: Claude Code → `.claude/skills/` (plus `~/.claude/skills/` globally); opencode and codex/cursor/cline etc. → **`.agents/skills/`** in the project; symlinks into a canonical store by default, `--copy` available. Our chosen targets match where the skills CLI itself writes.
3. **Versions**: no semver anywhere — the `~/.agents/.skill-lock.json` lockfile stores `sourceUrl`/`ref`/tree-SHA; `npx skills update` compares SHAs via the Trees API and reinstalls from source#ref. No version shown on the skill page.
4. **Listing is automatic**: the first third-party `npx skills add` from a public GitHub repo puts it on skills.sh; no registration, badge available at `skills.sh/b/<owner>/<repo>`.
