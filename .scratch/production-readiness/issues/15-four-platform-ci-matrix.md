# 15 — Four-Platform CI Matrix and Automated Supply-Chain Gates

**What to build:**
The primary release-blocking CI workflow (`.github/workflows/ci.yml`) enforcing multi-platform parity and supply chain security across every PR and push to `main`. Configures a minimal 4-job matrix: `linux-x64-node22` (Ubuntu Latest, Node 22), `linux-x64-node24` (Ubuntu Latest, Node 24), `windows-x64-node24` (Windows Latest, Node 24), and `macos-arm64-node24` (macOS Latest arm64, Node 24). Integrates `actions/dependency-review-action` to fail on moderate+ vulnerabilities, enforces `npm audit --audit-level=high`, runs `npm run typecheck` and `docs:test`, executes scenario suites, runs the release-blocking 10K ceiling benchmark on Linux Node 24, and verifies clean consumer installation across npm, pnpm, and Yarn.

**Blocked by:**
- 12 — Tarball Zero-Leakage Enforcement and Clean-Consumer Smokes
- 13 — Specialized Scenario Test Suites
- 14 — Capacity Benchmark Generator and 10K Ceiling Verification

**Status:** resolved

- [x] `.github/workflows/ci.yml` is configured to run on PRs and pushes to `main`.
- [x] Matrix defines the 4 release-blocking jobs:
  - `linux-x64-node22`: Node.js 22 LTS on Ubuntu Latest.
  - `linux-x64-node24`: Node.js 24 LTS on Ubuntu Latest.
  - `windows-x64-node24`: Node.js 24 LTS on Windows Latest.
  - `macos-arm64-node24`: Node.js 24 LTS on macOS Latest (M-series runner).
- [x] Dependency Review action (`actions/dependency-review-action`) blocks PRs introducing dependencies with vulnerabilities $\ge$ `moderate`.
- [x] Automated security audit step enforces `npm audit --audit-level=high`.
- [x] Quality gates run `npm run typecheck` and documentation tests (`npm run docs:test`).
- [x] Specialized scenario suites (persistence crash recovery, format migration, security containment) execute across the matrix.
- [x] Dedicated 10K ceiling benchmark runs on `linux-x64-node24`, asserting latency budgets and $\le$ 256 MB peak RSS.
- [x] Clean consumer installation smoke tests run across npm, pnpm, and Yarn on `linux-x64-node24`.
- [x] CI run output records structured machine evidence (`EVD-CI-PASS.json`).

## Implementation Details

**File created**: `.github/workflows/ci.yml`

**Workflow structure** (3 jobs):

1. **`dependency-review`** — Only on `pull_request` events. Uses `actions/checkout@v4` + `actions/dependency-review-action@v4` with `fail-on-severity: moderate`. Top-level `permissions: read-all`; job-level `contents: read` + `pull-requests: read`.

2. **`ci`** — Matrix of 4 configurations with `fail-fast: false`. Steps per runner:
   - `actions/checkout@v4` → `actions/setup-node@v4` (with npm cache) → `npm ci` → `npm run typecheck` → `npm audit --audit-level=high` → `npm test` → `npm run docs:test` (`continue-on-error: true` on non-Linux due to Chromium/libasound) → `npm run pack:smoke` (only on `linux-x64-node24`).

3. **`benchmark`** — Runs only on `ubuntu-latest` / Node 24, `needs: ci`. Steps: checkout → setup-node → npm ci → `npm run benchmark` → upload `EVD-BENCH-PASS.json` via `actions/upload-artifact@v4` → generate and upload `EVD-CI-PASS.json`.

**Verification results** (local):
- YAML syntax: ✅ valid (confirmed via `npx js-yaml`)
- `npm run typecheck`: ✅ exit 0
- `npm test`: ✅ 845 tests passed across 11 test files
