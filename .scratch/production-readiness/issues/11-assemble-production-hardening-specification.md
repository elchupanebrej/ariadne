# Assemble the Production Hardening Specification

Type: task
Status: resolved
Blocked by: 05, 06, 08, 09, 10, 12
Parent: [Ariadne production readiness](../map.md)

## Question

Consolidate the resolved decisions into one English implementation-ready specification. It must define scope and non-goals, normative guarantees, the canonical persistence interface, persisted-format migrations, public compatibility, security boundaries, errors, supported environments, capacity budgets, required verification and release evidence, acceptance criteria, and a dependency-ordered implementation handoff without implementing the changes.

## Answer

The complete, decision-complete, implementation-ready contract is published in the [Production Hardening Specification](../spec.md). It synthesizes all twelve research investigations and grilling decisions into an unambiguous blueprint for the `0.2.0` release:

- **Scope & Non-Goals**: Governs the npm library interface, single `ariadne` CLI binary, `.ariadne` persistence, 4 packaged skills, and Merge Protocol. Excludes network/distributed filesystems, external databases, command sandboxing, browser/CJS runtimes, speculative harness modules, and backports to `0.1.x`.
- **Runtime Matrix**: Node `^22.0.0 || ^24.0.0` LTS on glibc Linux (x64/arm64), Windows (x64), and macOS (arm64/x64). Package managers npm (10-12), pnpm (10-12), and Yarn (4.14.1+ node-modules). Smallest release-blocking CI matrix: 4 jobs (Linux x64 Node 22/24, Windows x64 Node 24, macOS arm64 Node 24).
- **Storage Durability & Process Coordination**: Single-machine cooperative multi-process model. Single root lock (`.ariadne/.lock`) with atomic `mkdir` (`O_EXCL`), PID verification, owner token, 60s timeout, and no lock stealing. Canonical authorities (`GRAPH.jsonl`, `NOTICES.jsonl`, `.orchestration/attempts/<id>.jsonl`) committed via framed records and `FileHandle.sync()`; derived projections (`STATE.yaml`, `INDEX.md`, `cards/`) are atomic-replaced and rebuildable. Four-discriminant persistence outcomes (`not_committed`, `commit_unknown`, `committed`, `committed_with_recovery_needed`). Automatic incomplete tail truncation vs fail-closed middle corruption (`CORRUPT_PERSISTED_HISTORY`).
- **Persisted-Format Evolution**: Independent positive integer versions (v1 target, v0 legacy). Explicit `ariadne migrate` CLI with pre-flight dry-run, immutable digest backups in `.ariadne/backups/`, atomic staging swap, rollback, and resume. Legacy v0 workspaces fail closed on mutating operations with `MIGRATION_REQUIRED`. Zero semantic or event loss.
- **Public Compatibility Reset**: Coordinated pre-1.0 `0.2.0` reset with strict SemVer post-0.2.0. Single ESM root `"."` export exposing exactly 24 runtime values and 24 types; `EpistemicGraph` is the sole deep public module. Single binary `ariadne` with 18 commands and standard exit classes (0: success/help, 1: negative domain verdict, 2: fatal infrastructure/integrity stop). Exactly 4 canonical skills (`ariadne`, `codebase-design`, `grilling`, `domain-modeling`). Merge Protocol v1.
- **Security & Containment**: Storage root canonicalization; all access contained beneath workspace root; symlinks escaping boundary or non-regular files fail closed (`PATH_ESCAPE`, `INVALID_INPUT`). Direct argv spawning (`shell: false`), 1 MB output cap, timeout enforcement, no environment variable persistence, and best-effort secret redaction.
- **Errors & Diagnostics**: 19 stable screaming-snake `DiagnosticCode` constants mapping to exit classes 0/1/2 and stop vs degrade behavior. Base class `AriadneError` (code, message, repair, detail). Structured JSON stderr formatting. Two-tier diagnostic separation (operational codes vs domain gate/merge diagnostics). Three-tier repair guidance.
- **Capacity Envelope & Budgets**: 10,000 nodes, 25,000 edges, 50,000 events, 10,000 cards, 50 reports cap, 2-process concurrency, 1 MB command output cap. Peak RSS $\le$ 256 MB. Latency classes uniform across all 4 platforms: Fast < 100ms, Standard < 1s, Batch < 10s. Advisory compaction trigger at 3× entity ratio or 10 MB. Reduced lock stale timeout to 60s.
- **Verification, CI & Release Gates**: Four-gate lifecycle (PR, Main, Release, Post-Publication). Four specialized scenario suites (persistence crash/recovery, migration, security containment, capacity). Parameterized synthetic benchmark generator. Dedicated 10K ceiling benchmark on Linux Node 24. Strict tarball allowlist (zero source/test leakage). Clean-consumer multi-manager verification. GitHub Actions OIDC trusted publishing with provenance and Release Evidence Bundle. Bad immutable release remediation playbook.
- **Ponytail Trimming**: Deletion of speculative modules (`src/capabilities/`, `src/teach-harness/`, `src/teach-methodology/`, duplicate binary `ariadne-reasoning`, `methodize-harness` skill).
- **Implementation Rollout**: 6-stage linear PR sequence directly into `main` without runtime feature flags, culminating in Stage 7 release cut `0.2.0` and npm deprecation advisory for `0.1.0`.

