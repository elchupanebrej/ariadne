# 17 — Pre-first-publish package surface repair

**What to build:** A package consumer installing the tarball gets a clean, typed, documented, license-carrying package with zero install-time scripts: TypeScript declarations with a `types` entry, an intentional `exports` map exposing only the retained thin-path surfaces (at minimum `"."` with types/import conditions, plus `"./cli"` if deep import matters), a root README and LICENSE, and prebuilt JavaScript via the existing prepack build. The teaching-module star-exports leave the root export surface and teaching modules are excluded from the published runtime — safe now because the package has never been published. The four pinned thin-path modules (attempt, controller, release-bundle, self-application) keep their current surfaces untouched.

**Blocked by:** None — can start immediately (independent of tickets 15–16).

**Status:** resolved

- [x] Build emits declarations; `types` entry present and resolving.
- [x] Intentional `exports` map exposing only retained class-(c) surfaces; no accidental exports.
- [x] Root README.md and LICENSE present in the tarball (both FAIL in the Rung 6 check today).
- [x] Zero install-time scripts; prebuilt JS ships in the tarball via prepack.
- [x] Teach-module star-exports removed from the root export surface; teaching modules excluded from the published runtime (`files` whitelist).
- [x] Pinned thin-path modules retained untouched; the no-kernel import-allowlist test still passes.
- [x] Full suite and typecheck green after the export trim.

## Comments

Parent spec: `specs/graph-native-continuation-and-package-repair.md`. Audit basis: `EVD-graph-native-harness-contract-r1` question 3/4 — teach files are 28.8% of the tarball (260,109 B of 904,382 B) with no non-test, non-star-export consumer. After the first publish, this trim becomes major-release territory.
