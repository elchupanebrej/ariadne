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

- [Research the supported runtime matrix](issues/01-research-supported-runtime-matrix.md) — support Node 22/24 LTS on a four-job Linux/Windows/macOS matrix, with package-manager boundary smokes folded into Linux/Node 24.
- [Research filesystem durability and process coordination](issues/02-research-filesystem-durability.md) — use one root lock and one flushed framed journal as authority; rebuild projections, never steal locks by age alone, and promise process-crash consistency rather than universal power-loss durability.
- [Research npm release integrity](issues/03-research-npm-release-integrity.md) — publish once from trusted CI, verify the exact packed artifact, retain reviewed release notes, and recover bad immutable versions by deprecation, dist-tag correction, and a new release.
- [Decide the persistence transaction and recovery contract](issues/04-decide-persistence-contract.md) — one root-locked canonical graph/notice protocol with per-attempt pointer ledgers, safe owner-aware recovery, idempotency, and explicit commit outcomes; projections are rebuildable.
- [Decide persisted-format evolution and migration](issues/05-decide-persisted-format-migration.md) — independent legacy-aware format versions, explicit lock-protected staged migration, immutable backups, no mixed-version reads, and lossless history/projection verification.
- [Decide the public interface and compatibility policy](issues/06-decide-public-interface-compatibility.md) — reset `0.2.0` to an explicit ESM graph/schema/gate/method/CLI interface, one `ariadne` binary, four packaged skills, and tarball-only compatibility evidence while controllers, adapters, and worktrees remain internal.
- [Decide the security and trust-boundary contract](issues/07-decide-trust-boundary.md) — validate and bound all untrusted data, contain filesystem access, execute only explicit direct commands, redact persisted output, and make no sandbox or confidentiality promise.
- [Decide errors, diagnostics, and repair behavior](issues/08-decide-errors-and-diagnostics.md) — 18 flat `DiagnosticCode` constants mapped to exit classes 0/1/2; one `AriadneError` class with code/message/repair/detail; exit-2 = full stop, exit-1 = domain verdict with continuation; structured JSON stderr; three-tier mandatory/optional/never repair guidance; detail-only redaction.
- [Decide the capacity and performance evidence contract](issues/09-decide-capacity-and-performance.md) — 10K-node/25K-edge/50K-event ceiling with 256 MB RSS; three latency tiers (fast <100ms, standard <1s, batch <10s) uniform across the CI matrix; parameterized benchmark generator; 1 MB command-output bound; 2-process concurrency; compaction trigger at 3× ratio or 10 MB (advisory only, implementation deferred); new `CAPACITY_EXCEEDED` diagnostic code; 50-report cap; lock timeout reduced to 60s.
- [Decide CI and release evidence](issues/10-decide-ci-and-release-gates.md) — four-gate lifecycle (PR/main/release/post-publish), 4-platform matrix with dedicated 10K ceiling benchmark on Linux Node 24, per-test tempdir isolation, 4 specialized scenario suites, strict tarball allowlist, multi-package-manager clean consumer tests, OIDC trusted publishing with provenance, and immutable bad-release deprecation playbook.
- [Decide the implementation rollout and backport sequence](issues/12-decide-implementation-rollout-and-backport-sequence.md) — 6-stage dependency-ordered linear PR sequence to 0.2.0 without runtime flags; immediate fail-closed legacy protection in Stage 2 with Stage 3 in-repo dogfood migration of .ariadne; zero backports to 0.1.x with npm deprecation; complete Ponytail deletion of speculative modules; cumulative stage exit gates culminating in 4-platform CI and 10K benchmark verification.
- [Make legacy migration atomic, resumable, and path-contained](issues/20-atomic-resumable-migration.md) — durable manifest and marker checkpoints, containment-checked staged swaps and rollback, and marker-aware read barriers prevent mixed authorities during interruption.
- [Assemble the Production Hardening Specification](issues/11-assemble-production-hardening-specification.md) — complete decision-complete implementation specification ([spec.md](spec.md)) consolidating scope, runtime matrix, storage durability, format migration, public compatibility, security boundaries, error model, capacity limits, CI/release gates, Ponytail deletions, and 6-stage rollout to 0.2.0.

## Not yet specified

<!-- Open child tickets are the frontier; unresolved fog is recorded here only when it cannot yet be stated as a sharp question. -->

## Out of scope

- Implementing or refactoring production code during this Wayfinder effort.
- Network filesystems, distributed writers, a hosted service, or a database-backed deployment.
- A GUI, book publication work, and new ecosystem integrations.
- Sandboxing arbitrary commands explicitly configured by the user.
