# Research: skills.sh / `npx skills` mechanics

Research ticket: `.scratch/installable-skills/issues/01-skills-sh-mechanics.md`
Date: 2026-08-25. All facts verified against primary sources: the `vercel-labs/skills` README and source code, and skills.sh docs pages.

Sources used:

- CLI repo README: https://github.com/vercel-labs/skills (README.md on `main`)
- Lockfile implementation: https://github.com/vercel-labs/skills/blob/main/src/skill-lock.ts
- Update implementation: https://github.com/vercel-labs/skills/blob/main/src/update.ts and src/update-source.ts
- skills.sh docs overview: https://skills.sh/docs
- skills.sh FAQ: https://skills.sh/docs/faq
- Example skill page: https://skills.sh/mattpocock/skills/tdd

---

## Q1. How does `npx skills add owner/repo@skill` find skills in a repository?

**Accepted source formats** (README, "Source Formats"):

- GitHub shorthand `owner/repo`, full GitHub URL, direct URL to a skill subdirectory (`https://github.com/owner/repo/tree/main/skills/<name>`), GitLab URL, any git URL (SSH), local path, and direct download URLs to a single `SKILL.md` or a zip/tar/tgz archive.
- `source@skill-name` selects one skill from a multi-skill repo; equivalently `-s/--skill <name>`. The `#ref` suffix pins a branch/tag.

**Expected layout — no metadata beyond SKILL.md frontmatter is required.**

A skill is simply a directory containing a `SKILL.md` with YAML frontmatter. Required fields: `name` (lowercase, hyphens allowed) and `description`. That is all. One optional field exists: `metadata.internal: true` hides the skill from discovery unless `INSTALL_INTERNAL_SKILLS=1`. No registry file, manifest, package.json, or version field is needed (README "Creating Skills", "Skill Discovery").

**Discovery algorithm** (README "Skill Discovery", confirmed by src):

The CLI looks for `SKILL.md` files in these *container* directories at the repo root:

- the root itself (if it contains `SKILL.md`)
- `skills/`, `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
- ~60 agent-specific dirs: `.agents/skills/`, `.claude/skills/`, `.continue/skills/`, `.cursor/skills/`, `.roo/skills/`, etc.

Each container directory is walked **up to three levels deep**, so both flat layouts (`skills/<name>/SKILL.md`) and catalog layouts with one or two category levels (`skills/<category>/<name>/SKILL.md`, `skills/<cat>/<cat>/<name>/SKILL.md`) work. A `SKILL.md` found at a shallower level shadows anything nested below it. `--full-depth` additionally discovers `SKILL.md` files outside container dirs (e.g. under `examples/`). If nothing is found in standard locations, a recursive fallback search runs. Skills declared in `.claude-plugin/marketplace.json` / `.claude-plugin/plugin.json` are also discovered (Claude Code plugin-marketplace compatibility), searched at their declared depth without the depth-3 limit.

**Multi-skill repos: fully supported.** This is the normal case — the top of the skills.sh leaderboard is dominated by multi-skill repos (vercel-labs/agent-skills, mattpocock/skills, anthropics/skills, microsoft/azure-skills). `--list` shows available skills; `-s name1 -s name2` or `--skill '*'` picks them; interactive selection is the default.

---

## Q2. Where does the CLI put files for each agent? Does it write to `.agents/skills`?

**Yes — `.agents/skills/` is written, and is in fact the shared canonical project location for many agents.**

Installation scope (README "Installation Scope"):

| Scope | Flag | Location |
|---|---|---|
| Project (default) | — | `./<agent-dir>/skills/` inside your repo |
| Global | `-g` | per-agent home dir (table below) |

Install method: by default the CLI makes one canonical copy and **symlinks** each agent's skill dir to it ("single source of truth"); `--copy` makes independent copies instead.

Key agents (full table of 78+ agents in README "Supported Agents"):

| Agent | `--agent` | Project path | Global path |
|---|---|---|---|
| Claude Code | `claude-code` | `.claude/skills/` | `~/.claude/skills/` |
| OpenCode | `opencode` | `.agents/skills/` | `~/.config/opencode/skills/` |
| Codex | `codex` | `.agents/skills/` | `~/.codex/skills/` |
| Cursor | `cursor` | `.agents/skills/` | `~/.cursor/skills/` |
| Amp / Replit / universal | `amp`, `replit`, `universal` | `.agents/skills/` | `~/.config/agents/skills/` |
| Cline, Dexto, Kimi Code CLI, Loaf, Warp, Zed | … | `.agents/skills/` | `~/.agents/skills/` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` | `~/.gemini/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` | `~/.copilot/skills/` |
| Antigravity / Antigravity CLI | `antigravity` | `.agents/skills/` | `~/.gemini/antigravity[-cli]/skills/` |
| Windsurf | `windsurf` | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| Goose | `goose` | `.goose/skills/` | `~/.config/goose/skills/` |
| Droid | `droid` | `.factory/skills/` | `~/.factory/skills/` |

So for this repo's concern: installing with opencode as target writes into `.agents/skills/` (project) or `~/.config/opencode/skills/` (global); Claude Code always gets its own `.claude/skills/` path. The CLI auto-detects installed agents; if none detected, it prompts for selection. `-a/--agent` overrides.

---

## Q3. Versioning and updates

**Skills have no versions.** SKILL.md frontmatter carries only `name` + `description`; there is no semver, no release channel. Versioning is content-addressed via git:

**Lockfile** (`src/skill-lock.ts`): installs are recorded in `.skill-lock.json` (schema v3), stored globally at `$XDG_STATE_HOME/skills/.skill-lock.json`, falling back to `~/.agents/.skill-lock.json`. Each entry records:

- `source` (normalized `owner/repo`), `sourceType` (`github`, `gitlab`, `git`, `local`, `well-known`, …)
- `sourceUrl` — original URL used at install time, kept "for re-fetching updates"
- `ref` — branch/tag pin if one was used
- `skillPath` — subpath of the skill folder in the repo
- `skillFolderHash` — the **GitHub tree SHA of the whole skill folder**; changes when ANY file in the folder changes (fetched via GitHub Trees API)
- `installedAt`, `updatedAt`

**How `npx skills update [skills]` works** (`src/update.ts`):

1. Reads lock entries, groups them by `source` + `ref`.
2. For GitHub sources: fetches the current repo tree once via the Trees API and compares each skill folder's tree SHA against `skillFolderHash`. Different SHA ⇒ update available. Also detects skills deleted upstream and prompts for removal.
3. For non-GitHub sources: clones into a temp dir and computes an equivalent local content hash.
4. Applies updates by re-running the install against the recorded source/ref/skillPath (`buildUpdateInstallSource` in src/update-source.ts builds e.g. `owner/repo/<folder>#ref`). New installs always fetch current contents.
5. Flags: `-g` global only, `-p` project only, `-y` non-interactive, positional names update specific skills.

**What the user sees on a skills.sh skill page** (verified on https://skills.sh/mattpocock/skills/tdd): install command, summary (the frontmatter description), full rendered SKILL.md, total install count, link to the GitHub repo, repo star count, "First Seen" date, and security-audit badges (e.g. Socket/Snyk passes). **No version number is shown anywhere** — freshness is implied by the upstream repo state; `npx skills add` always installs latest.

---

## Q4. Getting listed on skills.sh

**Listing is automatic, telemetry-driven, and requires no registration.** From the FAQ (https://skills.sh/docs/faq): *"Skills appear on the leaderboard automatically through anonymous telemetry when users run `npx skills add <owner/repo>`. Once your skill is installed by users, it will be tracked and appear in the rankings based on its installation count."*

Details:

- Ranking = aggregate anonymous install counts reported by the CLI (docs: "How skills are ranked"). No sign-up, submission, or review step exists.
- Only public repos get tracked/listed: the CLI sends repo+skill identifiers in telemetry **only after GitHub confirms the repo is public** (README "Telemetry"). Private-repo installs are never reported.
- The repo must therefore be public on GitHub (or another supported host) for others to install and for the leaderboard entry to appear. A skill page materializes once real installs occur; there is no manual catalog.
- Optional promo artifact: an install-count badge, `[![skills.sh](https://skills.sh/b/owner/repo)](https://skills.sh/owner/repo)` (docs "Badge").
- Telemetry can be disabled by installers (`DISABLE_TELEMETY`/`DO_NOT_TRACK=1`) — such installs don't count toward rankings.

Practical checklist for publishing ariadne's skills: put them in a **public** GitHub repo under `skills/<name>/SKILL.md` (multi-skill repo fine), each with valid `name`/`description` frontmatter — that's the entire requirement. Listing follows from the first third-party `npx skills add`.
