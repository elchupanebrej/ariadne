# Contract of the `ariadne install` subcommand

Type: grilling
Blocked by: 01, 02

## Question

Specification of the command that installs the bundle in one step:

1. Surface: name (`install`), flags (global `~/.agents/skills` vs project `.agents/skills`), default behavior.
2. What exactly it installs: all four skills of the set; where it takes the files from (bundled in the package vs from the repo).
3. Channel conflict: the skills CLI installs **symlinks** into a canonical store by default (with a `--copy` option) and writes into `.agents/skills` itself; how does our command detect already-installed state (symlink vs copy) and what does it do then?
4. Bundle check: how the command verifies the binary works (self-check) and that the installed skills match the CLI version.
5. Skill behavior when the CLI is still missing (skills.sh channel): loud degradation in SKILL.md — pin down the exact contract text.
