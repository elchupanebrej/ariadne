# Decide CI and release evidence

Type: grilling
Status: resolved
Blocked by: 01, 03, 05, 06, 07, 09
Parent: [Ariadne production readiness](../map.md)

## Question

Which checks must pass before merge, before packaging, and before registry publication? Decide the platform matrix, deterministic test isolation, corruption and concurrency scenarios, migration fixtures, security checks, dependency audit policy, packed-consumer tests, CLI smoke tests, artifact inspection, provenance, release notes, and post-publication verification. Define the evidence retained for a release and the response to a bad immutable npm version.

## Comments

- 2026-09-07 — Grilling round 1: the user accepted the recommended four-gate lifecycle architecture (PR, Main, Release, Post-Publication), full 4-platform matrix execution across stages, mandatory specialized scenario suites (persistence/recovery, migration, security, capacity), strict tarball manifest allowlist, clean-consumer multi-manager verification, supply-chain baseline (moderate dependency review, high npm audit, 40-char SHA action pinning), OIDC trusted publishing with automatic provenance, immutable bad-release deprecation playbook, and permanent GitHub Release evidence bundles.
- 2026-09-07 — Grilling round 2: the user accepted the recommended dedicated Linux x64 Node 24 ceiling benchmark execution, three-package-manager clean consumer testing (npm, pnpm, yarn `nodeLinker: node-modules`), modular `.github/workflows/` structure (`ci.yml` and `release.yml`), strict fail-closed release tag and version parity verification, post-publication registry polling with exponential backoff and `npm audit signatures` provenance checks, and per-test `mkdtemp` isolation with process separation for concurrency.

## Answer

### Pipeline architecture and gating lifecycle

The release and verification pipeline is structured across four sequential gates split into two modular GitHub Actions workflows (`.github/workflows/ci.yml` and `.github/workflows/release.yml`):

1. **PR Gate (`ci.yml` on pull request targeting `main`)**:
   - Supply-chain diff check: `actions/dependency-review-action` fails on newly introduced vulnerabilities of severity `moderate` or higher.
   - Quality checks: `npm run typecheck`, documentation and asset tests (`npm run docs:test`).
   - Platform matrix verification: executes the full 4-platform matrix (Linux x64 Node 22, Linux x64 Node 24, Windows x64 Node 24, macOS arm64 Node 24) covering unit tests, specialized recovery/security suites, and smoke/mid benchmarks.
   - Ceiling-tier capacity gate: runs the 10,000-node synthetic benchmark on Linux x64 Node 24 asserting latency classes (<100ms/<1s/<10s) and peak RSS $\le$ 256 MB.
   - Clean-consumer smoke: packs the candidate tarball, inspects contents, and validates installation and execution in clean temporary consumers across npm, pnpm, and Yarn.

2. **Merge-to-Main Gate (`ci.yml` on push to `main`)**:
   - Reruns the complete 4-platform test matrix, specialized scenario suites, ceiling benchmark gate, and clean-consumer package smoke tests.
   - Enforces `npm audit --audit-level=high`.
   - Guarantees `main` remains continuously releasable.

3. **Tagged Release Gate (`release.yml` on push of tag `v*.*.*`)**:
   - Strict version parity verification: validates that the Git tag `vX.Y.Z` matches `"version": "X.Y.Z"` in `package.json` and `package-lock.json`, the working tree is clean, and the commit exists on `main`.
   - Release notes verification: confirms curated notes for `vX.Y.Z` exist before packaging begins.
   - Full matrix re-verification and build from a clean lockfile (`npm ci`).
   - Pack tarball and enforce strict tarball manifest allowlist inspection.
   - OIDC Trusted Publishing: publishes the packed tarball to the npm registry with provenance (`id-token: write`, `contents: read`).

4. **Post-Publication Gate (`release.yml` post-publish steps)**:
   - Registry propagation probe: polls `npm view ariadne-reasoning@<version>` with exponential backoff (up to 180 seconds).
   - Dist-tag check: validates `latest` resolves to the newly published version.
   - Provenance cryptographic signature verification: runs `npm audit signatures` on a clean install from the public registry.
   - Clean execution smoke: runs `npx ariadne-reasoning@<version> --version` in an isolated ephemeral environment.
   - Attaches the complete **Release Evidence Bundle** to the GitHub Release.

### Supported platform matrix and test isolation

- **Platform Matrix**:
  - `linux-x64-node22`: Ubuntu latest runner, Node.js 22 LTS.
  - `linux-x64-node24`: Ubuntu latest runner, Node.js 24 LTS.
  - `windows-x64-node24`: Windows latest runner, Node.js 24 LTS.
  - `macos-arm64-node24`: macOS latest runner (Apple Silicon), Node.js 24 LTS.
- **Deterministic Test Isolation**:
  - Every persistence, migration, CLI, and integration test runs in an independent temporary directory created via `mkdtemp` under the OS temporary directory, registered for guaranteed cleanup in `afterEach`.
  - Concurrency and lock contention tests run in isolated worker processes to prevent PID collision and host environment pollution.
  - The parameterized benchmark generator uses fixed pseudorandom seeds to ensure deterministic graph topology and edge density across runs.
  - No global mutable mocks or shared filesystem paths across test files.

### Mandatory specialized scenario suites

1. **Persistence & Crash Recovery Suite**:
   - Two-process root lock contention (`O_EXCL`), mutual exclusion, and lock handoff.
   - PID-absent fast-path recovery vs PID-alive stale-lock timeout (reduced to 60s per ticket 09).
   - Atomic commit semantics: staging writes, temporary rename, and sync.
   - Framed journal replay: validation, recovery rebuild of projections from canonical journal records.
   - Failure boundary: partial-write tail truncation (automatic recovery) vs middle frame corruption / revision gap fail-closed with `CORRUPT_PERSISTED_HISTORY`.

2. **Persisted-Format Migration Suite**:
   - Golden legacy v0 fixtures for all entities: graph history, notices, state overlays, index/card projections, attempt ledgers.
   - Dry-run validation: verifies source digests and expected version transitions without file system modification.
   - Immutable backup creation and digest-verified restoration.
   - Interrupted migration recovery: simulated crashes at every staging checkpoint; resumes cleanly when source/backup match or fails closed with repair guidance.
   - Rejection: mixed-version directories fail closed; unsupported newer formats produce `UNSUPPORTED_FORMAT`; corrupt canonical records reject migration.

3. **Security & Containment Suite**:
   - Containment boundary: directory traversal sequences (`../`) and symlink targets resolving outside the storage root fail closed with `PATH_ESCAPE`.
   - File validation: non-regular files (FIFOs, sockets, device nodes) are rejected.
   - Force policy: `--force` replaces only Ariadne-managed artifacts; attempts to target unmanaged user files fail closed.
   - Resource containment: external-command output exceeding 1 MB combined is truncated before persistence; command execution enforces direct argv execution with `shell: false`.
   - Secret handling: environment variables are never persisted; command output detail is redacted using the best-effort pattern before persistence or diagnostic emission.

4. **Capacity & Performance Suite**:
   - Parameterized synthetic benchmark generator:
     - Smoke tier (100 nodes) and Mid tier (1,000 nodes): executed across all 4 platform matrix jobs on every run.
     - Ceiling tier (10,000 nodes, 25,000 edges, 50,000 events): executed on Linux x64 Node 24.
   - Latency enforcement: Fast tier < 100 ms, Standard tier < 1 s, Batch tier < 10 s.
   - Memory enforcement: Peak RSS attributable to Ariadne heap $\le$ 256 MB.
   - Exceeding limits triggers `CAPACITY_EXCEEDED` (exit-class 2).

### Artifact inspection and clean-consumer verification

- **Tarball Manifest Allowlist**:
  - Built using `npm pack` and verified against an explicit file allowlist:
    - `dist/**` (ESM build, declaration `.d.ts` files, and CLI bundle).
    - `.agents/skills/**` (exactly the 4 packaged skills: `ariadne`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`).
    - `package.json`, `README.md`, `LICENSE`.
  - Any inclusion of source TypeScript files (`src/**`), test files (`test/**`, `*.test.ts`), configuration files (`tsconfig*.json`, `vitest.config.ts`), `.github/**`, or `.scratch/**` fails the packaging gate.
- **Clean-Consumer Multi-Manager Smoke**:
  - An isolated temporary consumer project with no repository links installs the packed `.tgz` file.
  - Verification across supported package managers (folded into Linux Node 24):
    1. `npm install <tarball>`
    2. `pnpm add <tarball>` (verifies symlink resolution)
    3. `yarn add <tarball>` (with `nodeLinker: node-modules`)
  - Consumer tests:
    - Typecheck against `dist/index.d.ts` confirming all public export symbols are importable without ambient type leaks.
    - CLI binary invocation (`ariadne --help`, `ariadne --version`).
    - Packaged skill verification confirming all 4 skills contain valid `SKILL.md` files and reference scripts.

### Supply chain security and workflow permissions

- **Vulnerability Checks**:
  - `actions/dependency-review-action` runs on PRs, failing on `moderate` or higher severity vulnerabilities in added or updated packages.
  - `npm audit --audit-level=high` required on `main` and release builds.
- **Workflow Hardening**:
  - All GitHub Actions actions pinned to immutable 40-character commit SHAs with version comments (e.g. `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`).
  - Principle of least privilege: default top-level `permissions: contents: read`. Release workflow elevates only for the publish step to `permissions: { id-token: write, contents: write }`.

### Release packaging, provenance, and release notes

- **Trigger & Identity**:
  - Releases are triggered exclusively by pushing a signed Git tag `vX.Y.Z`.
  - Tag must strictly match `package.json` `"version": "X.Y.Z"`.
  - Working tree must be clean.
- **Trusted Publishing & Provenance**:
  - Published using GitHub Actions OIDC Trusted Publishing; no long-lived npm tokens are stored.
  - Automatic SLSA provenance statement generation enabled (`--provenance`).
- **Release Notes**:
  - Release workflow verifies that `CHANGELOG.md` or the release notes document contains a dedicated section for `vX.Y.Z` (including breaking changes and compatibility disclosures for `0.2.0`).

### Release evidence bundle and audit retention

For every published release, an immutable **Release Evidence Bundle** is permanently attached to the GitHub Release:
1. `sha256sum` digest of the published `.tgz` tarball and the complete unpacked file list.
2. Provenance statement link and cryptographic signature verification report.
3. `EVD-CI-PASS` receipt: JSON record documenting the Git commit SHA, the 4 matrix runner IDs, Node.js and OS versions, package manager versions, and execution timestamps.
4. `EVD-BENCH-PASS` receipt: JSON record capturing benchmark measurements (latencies per tier, peak RSS) at the ceiling tier.
5. Reviewed markdown release notes.

### Bad immutable npm version remediation playbook

Published npm versions are immutable; a published version cannot be overwritten, modified, or republished. If a critical defect, invariant bypass, or security issue is discovered after publication, automation and maintainers follow this strict three-step recovery:

1. **Immediate Deprecation**:
   - Deprecate the defective version immediately with clear user guidance:
     ```bash
     npm deprecate ariadne-reasoning@<bad-version> "Critical: <reason>. Upgrade to <next-version> or pin to <good-version>."
     ```
2. **Dist-tag Redirection**:
   - Reset the `latest` dist-tag back to the last known-good stable release:
     ```bash
     npm dist-tag add ariadne-reasoning@<good-version> latest
     ```
   - This ensures new unpinned installations do not install the defective release while preserving dependency trees for existing consumers.
3. **Patch Publication**:
   - Implement the fix in source control.
   - Advance the version to a fresh patch release `vX.Y.(Z+1)`.
   - Re-run the full CI matrix, benchmark ceiling, artifact inspection, and clean-consumer gates.
   - Publish the new patch release and update GitHub Release notes.
4. **Emergency Unpublish Policy**:
   - `npm unpublish` is strictly restricted to emergency credentials/secret leakage discovered within npm's 72-hour unpublish window, and only if permitted by npm registry policy. It is never used for software bugs.
