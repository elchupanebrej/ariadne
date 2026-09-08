# Research npm release integrity

Type: research
Status: resolved
Blocked by: None
Parent: [Ariadne production readiness](../map.md)

## Question

Using current official npm and CI-provider documentation, what is the smallest production release baseline for this public package: authentication or trusted publishing, provenance, immutable version handling, packed-artifact verification, dependency review, generated declarations, changelog or release notes, and rollback after a bad publication? Separate registry requirements from optional supply-chain hardening.

## Answer

The smallest production baseline is one reviewed, tagged release published once from trusted CI, with a clean-lockfile build and verification of the exact npm tarball before publication. Prefer npm trusted publishing via GitHub OIDC (`id-token: write`, `contents: read`) and enable provenance; the fallback is account 2FA or a granular bypass-2FA token. Treat each published name/version as immutable: failed releases get a new version, never a republish.

The release gates are `npm ci`, `npm run verify`, `npm run pack:smoke`, and an explicit tarball inspection/consumer check confirming declarations, exports, CLI entry points, README, and LICENSE. Attach reviewed GitHub release notes whose version matches the package and tag. For a bad publication, stop, deprecate the bad version, move `latest` to the last known-good version, publish a fixed new version with fresh gates, and use unpublish only as an exceptional irreversible action.

Provenance, dependency review, full-SHA action pinning, and least-privilege workflow permissions are optional supply-chain hardening rather than npm registry acceptance requirements; provenance and dependency review are nevertheless recommended release/merge gates for this public package. GitHub artifact attestations/SBOMs are deferred unless Ariadne ships separately verifiable binaries, containers, or downloadable artifacts. Detailed primary-source findings and repository evidence: [npm release integrity research](../npm-release-integrity-research.md).
