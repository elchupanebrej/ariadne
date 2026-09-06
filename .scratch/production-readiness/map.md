# Wayfinder map: Ariadne production readiness

Label: `wayfinder:map`

## Destination

A decision-complete Production Hardening Specification for every shipped Ariadne surface, ready to hand to implementation. It fixes the required storage guarantees, supported environments, compatibility and migration policy, trust boundary, error model, capacity envelope, and release evidence without changing production code during this effort.

## Notes

- All documentation and tracker artifacts are written in English.
- In scope: the npm library interface, both CLI binaries, `.ariadne` persistence, packaged agent skills, Git/worktree behavior, and ecosystem adapters.
- The supported operating model is multiple processes on one machine using a local filesystem. Network filesystems and coordination across machines are excluded.
- The platform policy targets maintained Node.js LTS releases on Linux, macOS, and Windows; exact versions and package-manager coverage wait on primary-source research.
- Before 1.0, one documented breaking change to the TypeScript interface is acceptable. Existing `.ariadne` history must remain migratable without data loss.
- Production readiness requires no known data-loss or invariant-bypass path, deterministic CI on the supported matrix, installation tests from the packed artifact, defined public interfaces and persisted formats, documented recovery and errors, and measured limits for the declared capacity envelope.
- Repository files, imported artifacts, and CLI arguments are untrusted inputs. Ariadne does not promise to sandbox commands explicitly supplied by the user.
- Use `research` for research tickets; use `grilling` and `domain-modeling` for grilling tickets; use `codebase-design` when locating the persistence seam or shaping a public module interface; apply Ponytail to keep the final design to the smallest contract that meets the evidence.
- Planning only: tickets settle decisions and produce the final specification. Implementation begins after this map is complete.

## Decisions so far

<!-- One line per resolved child ticket: a gist plus a link to the detailed answer. -->

## Not yet specified

- The exact benchmark corpus and maximum supported graph/history size remain fog until the storage transaction model and platform matrix are settled.
- The implementation rollout and backport sequence remain fog until migration and release contracts are settled.

## Out of scope

- Implementing or refactoring production code during this Wayfinder effort.
- Network filesystems, distributed writers, a hosted service, or a database-backed deployment.
- A GUI, book publication work, and new ecosystem integrations.
- Sandboxing arbitrary commands explicitly configured by the user.
