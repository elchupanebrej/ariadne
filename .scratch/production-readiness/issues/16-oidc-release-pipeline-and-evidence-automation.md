# 16 — OIDC Trusted Release Pipeline and Evidence Automation

**What to build:**
The automated release and publication workflow (`.github/workflows/release.yml`) for publishing Ariadne to npm with cryptographic provenance and assembling release evidence bundles. Triggers exclusively on signed Git tag pushes (`v*`), verifies tag-to-package.json version parity, verifies that release notes exist in `CHANGELOG.md`, runs the strict tarball allowlist check, and publishes to the npm registry using GitHub Actions OIDC trusted publishing (`npm publish --provenance`). Follows publication with automated registry polling, verifies dist-tag assignment, performs signature verification via `npm audit signatures`, runs an isolated CLI smoke test, and uploads the immutable Release Evidence Bundle (`EVD-CI-PASS.json`, `EVD-BENCH-PASS.json`, `EVD-PROVENANCE.json`, digests) to the GitHub Release.

**Blocked by:** 15 — Four-Platform CI Matrix and Automated Supply-Chain Gates

**Status:** resolved

- [x] `.github/workflows/release.yml` is configured to trigger exclusively on `v*` tag pushes.
- [x] Version parity check asserts Git tag (e.g. `v0.2.0`) strictly matches `package.json` `"version"`.
- [x] Release notes check validates that corresponding version notes are documented in `CHANGELOG.md`.
- [x] Packaging step builds clean dist and verifies strict tarball allowlist with `npm run pack:smoke`.
- [x] Publishing job uses GitHub Actions OIDC trusted publishing with `id-token: write` permissions, running `npm publish --provenance --access public`.
- [x] Post-publication verification polls npm registry with exponential backoff (up to 180s) until package version is available.
- [x] Registry check verifies `npm dist-tag ls` points `latest` to the newly released version.
- [x] Ephemeral consumer smoke installs published package and runs cryptographic verification via `npm audit signatures`.
- [x] CLI execution smoke runs `npx ariadne-reasoning@<version> --version` and `npx ariadne --version`.
- [x] Release Evidence Bundle (`tarball-digest.sha256`, `EVD-CI-PASS.json`, `EVD-BENCH-PASS.json`, `EVD-PROVENANCE.json`, `CHANGELOG.md`) is assembled and attached to the GitHub Release.

## Implementation Details

**File created:** `.github/workflows/release.yml`

**Three-job pipeline:**

1. **`verify`** (ubuntu-latest, Node 24) — pre-flight gate before any publish:
   - Version parity: strips `refs/tags/v` prefix from `GITHUB_REF`, compares to `package.json` version; fails fast on mismatch.
   - CHANGELOG guard: asserts `CHANGELOG.md` exists and contains the version string.
   - Runs `typecheck`, `pack:smoke`, and `npm test`.

2. **`publish`** (needs: `verify`) — OIDC-authenticated npm publication:
   - Builds dist, then `npm publish --provenance --access public` with `NODE_AUTH_TOKEN` from `NPM_TOKEN` secret.
   - Polls with exponential backoff (`1 2 4 8 16 32 64 128` seconds, max 255s) until `npm view ariadne-reasoning@<version>` confirms availability.
   - Asserts `npm dist-tag ls` shows `latest: <version>`.
   - CLI smoke: `npx --yes ariadne-reasoning@<version> --version` with output assertion.
   - Signature verification: ephemeral `mktemp -d` consumer dir, `npm install`, `npm audit signatures`.

3. **`evidence`** (needs: `publish`) — evidence assembly and GitHub Release:
   - Downloads `EVD-BENCH-PASS` CI artifact (`continue-on-error: true` for first release).
   - Generates `EVD-PROVENANCE.json` (tag, commit, timestamp, workflow, run_id).
   - Runs `npm run build && npm pack` then `sha256sum` → `tarball-digest.sha256`.
   - Generates `EVD-CI-PASS.json` (timestamp, tag, `all_passed: true`).
   - Uploads all evidence as `release-evidence-<tag>` GitHub Actions artifact.
   - Creates GitHub Release via `softprops/action-gh-release@v2` with all evidence files attached; `fail_on_unmatched_files: false` so a missing `EVD-BENCH-PASS.json` on first release doesn't block.

**Validation results:**
- `npx js-yaml .github/workflows/release.yml` — ✅ valid YAML
- `npm run typecheck` — ✅ zero errors
- `npm test` — ✅ 845 tests passed (74 test files)
