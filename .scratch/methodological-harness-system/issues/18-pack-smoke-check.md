# 18 — Pack smoke check

**What to build:** One repeatable script that promotes the ad-hoc `EVD-packed-install-contract-r6` receipt into the standard portability check: `npm pack` → clean temporary consumer → install the tarball → type-check a documented import → run the packaged methodize-harness example checker. The script passing is the package-portability check; it is measured after the exports/types/README/LICENSE repair, not before.

**Blocked by:** 17 — Pre-first-publish package surface repair.

**Status:** resolved

- [x] Script packs the current worktree, installs the tarball into a clean temporary project, and runs the check end to end.
- [x] Documented import type-checks from the consumer project (proves declarations + `types`).
- [x] Packaged methodize-harness example checker runs successfully outside the repository (proves the skill example is self-contained, `node:` builtins only).
- [x] Script fails with a clear message on any step failure (install failure, import error, checker failure).
- [x] Script documented in the README or package scripts so maintainers run it the same way every time.

## Comments

Parent spec: `specs/graph-native-continuation-and-package-repair.md`. Falsification predicate: package portability fails if install, typed import, or the packaged checker fails — measured after the surface repair.
