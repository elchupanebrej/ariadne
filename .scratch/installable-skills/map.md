# Wayfinder map: Installable Ariadne skills

Label: wayfinder:map

## Destination

A third-party user installs the full Ariadne skill set with one command from a public repository — via `npx skills add <owner>/<repo>@<skill>` or `npx ariadne install` (a CLI subcommand that lays skills into `.agents/skills` and `~/.agents/skills`) — and gets a working bundle: skills + CLI. The map leads to the state where all decisions are made and both channels are published, leaving only the subcommand implementation to build.

## Notes

- Domain: distribution of agent skills (the skills.sh ecosystem) + an npm package with a CLI.
- Standing preference: **all documentation in this repository is written in English** — including this map, its tickets, and any answers recorded on them.
- Decisions made while charting: both channels (skills.sh + npm); installation is a bundle (all-or-nothing); this repository is published as-is; install targets are only `.agents/skills` and `~/.agents/skills`; installable units are the whole skill set (`ariadne`, `methodize`, `methodize-ariadne`, `methodize-harness`; formerly named teach-*).
- Known facts: no git remote yet; npm package is `private: true`; the `ariadne` skill requires the CLI (`ariadne report`, `.ariadne/` state); `.scratch/` is not gitignored.
- Skills per ticket type: research → "research"; grilling → "grilling" + "domain-modeling"; prototype → "prototype".
- Plan-don't-do: implementing the `install` subcommand is post-map work; the map ends with a specification and published channels.

## Decisions so far

<!-- the index — one line per closed ticket: enough to judge relevance, then zoom the link for the detail the ticket holds -->

- [skills.sh mechanics](issues/01-skills-sh-mechanics.md) — a skill is just a directory with a `SKILL.md` (frontmatter only), multi-skill repos are the norm; the skills CLI itself writes into `.agents/skills`; no versions — tree-SHA in a lockfile, updates via `npx skills update`; listing on skills.sh is automatic from a public repo.
- [npm delivery](issues/02-npm-delivery.md) — the name `ariadne` is taken by an abandoned 2014 package; install scripts are blocked by default (npm 12 / pnpm / yarn) → CLI must work without postinstall; first publish needs verified email + 2FA, `--access public`.
- [Portability of the methodize skills outside this repository](issues/09-teach-skills-portability.md) — all three need edits; the shared breakage vector is repo-root-relative paths; `methodize-ariadne` breaks worst (~20 paths + a call into the repo's build output).

## Not yet specified

<!-- see "Fog of war": in-scope fog you can't ticket yet; graduates as the frontier advances -->

- CI-based publishing automation (npm on tag, skills.sh sync) — can only be pinned down after the first manual publishes.
- Bundle versioning policy for users (how to tell "skills updated but CLI didn't") — waits on the `ariadne install` contract.

## Out of scope

<!-- see "Out of scope": work ruled beyond the destination; closed, never graduates -->
