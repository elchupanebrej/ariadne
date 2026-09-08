# npm release integrity research

As of 2026-09-06. Sources are limited to current npm documentation and official GitHub/GitHub Actions documentation. The repository-specific observations below come from [`package.json`](../../package.json), [`tsconfig.build.json`](../../tsconfig.build.json), and [`scripts/pack-smoke.mjs`](../../scripts/pack-smoke.mjs).

## Finding

The smallest production baseline is: publish from a reviewed version tag through one trusted CI workflow; build and test from a clean lockfile; inspect and install-test the exact npm package tarball; verify declarations and runtime entry points from that tarball; attach reviewed release notes; and have a documented bad-release response that deprecates the bad version, moves the `latest` tag to a known-good version, and publishes a new fixed version. Provenance and dependency review are not required for the npm registry to accept a package, but are small, worthwhile supply-chain gates for this public package.

## Registry requirements

### Package identity and public visibility

`name` and `version` are required for a publishable package. The version must be npm-semver-parseable, and the name/version pair is the package's unique identity. npm rejects a publish when that pair already exists; even after unpublishing, the same pair can never be reused. The current package is unscoped (`ariadne-reasoning`), so npm's default public registry behavior applies. If it becomes scoped, the first public publish must use `--access public`. [npm `package.json`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [npm `publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

### Authentication

Preferred baseline: configure an npm trusted publisher for the exact GitHub organization/user, repository, and workflow filename, then publish from a GitHub-hosted runner with `id-token: write` and `contents: read`. Trusted publishing exchanges the workflow's short-lived OIDC identity for publish authorization, so no long-lived `NPM_TOKEN` is needed. The trusted-publisher configuration can optionally bind a GitHub Environment. For configurations created after 2026-09-03, direct `npm publish` must be explicitly allowed; otherwise use the staged-publishing path. [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)

Fallback baseline when trusted publishing cannot be used: the publishing account must have 2FA enabled, or CI must use a granular access token created with bypass-2FA enabled. npm recommends trusted publishing for CI/CD and recommends restricting token publishing after trusted publishing is configured. [npm 2FA publishing requirements](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)

### Immutable version handling

Release automation must derive one new semver version from the reviewed source and publish it once. `npm version` can update `package.json` and `package-lock.json`, create a version commit, and create a Git tag; it refuses a dirty working tree unless forced. Do not retry a failed-quality release by editing and republishing the same version: npm's registry data is immutable and a published name/version cannot be reused. [npm `version`](https://docs.npmjs.com/cli/v11/commands/npm-version/), [npm `publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/)

## Release gates for this package

### Build, declarations, and packed artifact

The release job should run, in order, `npm ci`, `npm run verify`, and the package smoke test before publishing. The existing package configuration already points `types` and the export condition to `dist/index.d.ts`, emits declarations in `tsconfig.build.json`, includes `dist` in `files`, and runs `npm run build` from `prepack`. npm documents that `prepack` runs before both `npm pack` and `npm publish`, and that `files` controls what enters the tarball. [npm lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/), [npm `package.json`](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/), [npm `pack`](https://docs.npmjs.com/cli/v11/commands/npm-pack/)

Minimum artifact check:

1. Run `npm pack --dry-run` and review the file list for accidental omissions or inclusions.
2. Create the tarball with `npm pack` in a temporary directory.
3. Install that tarball into a clean temporary consumer and run the package's documented import/type-check and runtime smoke checks. The existing `npm run pack:smoke` script already performs this shape of check.
4. Confirm the tarball contains `dist/index.d.ts`, the import targets named by `exports`, the CLI entry point, README, and LICENSE. Publish only after this check passes.

`npm pack --dry-run` reports what would be packed; `npm pack` creates the tarball that npm publishes, and npm records integrity metadata for published tarballs. [npm `publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/), [npm `pack`](https://docs.npmjs.com/cli/v11/commands/npm-pack/)

### Changelog and release notes

The smallest acceptable release record is a Git tag/release whose version exactly matches `package.json`, with reviewed notes describing user-visible changes, compatibility, and the published package version. GitHub's generated release notes are sufficient for a minimal process: they include merged pull requests, contributors, and a full-changelog link, and can be reviewed before publishing. [GitHub automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes), [GitHub managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

## Provenance and optional supply-chain hardening

| Control | Registry requirement? | Smallest useful baseline |
| --- | --- | --- |
| npm provenance | No | Make it a release gate. With GitHub Actions, use a public repository, a GitHub-hosted runner, `id-token: write`, and either trusted publishing (automatic provenance) or `npm publish --provenance`. npm requires npm CLI 9.5.0+ for provenance and requires the package's public `repository` to match the source repository. Verify published/installed packages with `npm audit signatures`. |
| Dependency review | No | Add the official `actions/dependency-review-action` on `pull_request`, grant only `contents: read`, make the check required before merge, and choose a severity/scope policy. GitHub's example uses `fail-on-severity: moderate`; the action reports newly introduced vulnerable dependencies. |
| Action pinning and least privilege | No | Pin third-party actions to full commit SHAs and declare minimal workflow permissions. GitHub documents SHA pinning as the immutable-action option. |
| GitHub artifact attestations/SBOM | No | Skip for the npm-only baseline. Add only if this release also ships binaries, containers, or separately downloadable build artifacts; GitHub documents attestations as useful only when consumers verify them. |

Sources: [npm provenance generation](https://docs.npmjs.com/generating-provenance-statements/), [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/), [npm provenance verification](https://docs.npmjs.com/viewing-package-provenance/), [GitHub dependency review](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/customize-dependency-review-action), [official dependency-review action](https://github.com/actions/dependency-review-action), [GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use), [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)

Provenance is not a security guarantee by itself: npm describes it as a verifiable link to source and build instructions, which consumers still need to assess. The repository's public `repository` field is already present; the future release workflow must publish from that matching public repository. [npm provenance generation](https://docs.npmjs.com/generating-provenance-statements/)

## Bad-publication response

1. Stop further publishing and identify the bad version and current dist-tags.
2. Deprecate the bad version with a clear warning. npm recommends deprecation over unpublishing because it preserves dependents' installs while warning users. [npm deprecation](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/)
3. Move `latest` to the last known-good version with `npm dist-tag add ariadne-reasoning@<good-version> latest`. This affects unpinned installs that resolve `latest`; consumers pinned to the bad version still need the deprecation/new-release guidance. [npm dist-tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/)
4. Fix the source, bump to a new semver version, rerun every release gate, publish the fixed version, and issue release notes explaining the correction. The bad version number cannot be reused. [npm `publish`](https://docs.npmjs.com/cli/v11/commands/npm-publish/)
5. Treat `npm unpublish` as an exceptional, irreversible action—not the normal rollback. For a new package, npm allows unpublishing within 72 hours only while no other public-registry packages depend on it; later cases have further restrictions. Unpublishing does not make the version reusable. [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/)

## Recommended release shape

For this package, the minimum durable workflow is:

```text
reviewed vX.Y.Z tag
  -> npm ci
  -> npm run verify
  -> npm run pack:smoke
  -> trusted OIDC publish with provenance
  -> verify registry provenance/signatures and dist-tag
  -> GitHub release notes/release record
```

The registry-required portion is package identity, valid access authorization, and one immutable publish. Everything involving packed-consumer verification, declarations, release notes, provenance, dependency review, action pinning, and rollback procedure is release discipline or optional supply-chain hardening layered around that registry operation.
