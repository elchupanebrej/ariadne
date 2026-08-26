# Portability of the methodize skills outside this repository

Type: research
Status: resolved

## Question

The whole skill set is published (`methodize`, `methodize-ariadne`, `methodize-harness`; formerly named teach-*). Which parts actually work for a third-party user:

1. What external links/dependencies does each of the three skills have (mentions of GSD skills, repo-local paths, `.planning/`, artifacts of this project)?
2. What breaks immediately after installing into someone else's environment, and what works as-is?
3. Does each need edits before publication, and of what kind (cut sections, mark requirements, leave as-is)?

Answer: a per-file breakdown with a verdict of "works as-is / needs edits X".

## Answer

Important: the ticket's original names were stale — the directories are now `methodize`, `methodize-ariadne`, `methodize-harness`. Full analysis: [docs/research/teach-skills-portability.md](../../../docs/research/teach-skills-portability.md).

| Skill | Verdict | Why |
|---|---|---|
| `methodize-ariadne` | needs edits | ~20 hardcoded `.agents/skills/ariadne/…` paths + its check spawns the CLI from the repo's build output (`dist/cli/index.js gate all --strict`) |
| `methodize-harness` | small edits | only `bootstrap.lock` pins repo files (including a sibling skill) + a stale sha256 in a fixture |
| `methodize` | small edits | router references siblings via repo-root paths; self-explanation cites `docs/designing_methodological_guides.md`, which won't ship |

Shared breakage pattern: repo-root-relative paths for cross-references; runnable checks are nearly portable (2 of 3 green on bare node).
