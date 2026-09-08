# Changelog

All notable changes to Ariadne are documented here.

## [0.2.0] - 2026-09-08

This is the first production-oriented release and the one permitted pre-1.0
public contract reset. The 0.1.0 package was an unhardened experimental
prototype; consumers should migrate to 0.2.0 before relying on persisted state
or the public API.

### Added

- Durable epistemic graph persistence backed by an append-only journal,
  atomic projection writes, crash recovery, and process-safe workspace locking.
- Versioned workspace migration with legacy-format detection, dry-run and
  rollback-safe migration flow, and fail-closed protection for unmigrated
  workspaces.
- Storage-root containment and regular-file checks, direct command execution
  safeguards, bounded output handling, and diagnostic secret redaction.
- A focused public CLI for workspace initialization, status and reporting,
  graph nodes and edges, invalidation, gates, ingestion, visualization,
  merging, and migration.
- Production verification gates covering type safety, specialized persistence
  and security scenarios, capacity benchmarks, package zero-leakage checks,
  and clean consumer installation.

### Changed

- Reset the root package contract around the intentional public graph, gate,
  method-contract, and CLI exports; storage drivers and adapter internals are
  private implementation details.
- Standardized fail-closed diagnostics and CLI exit semantics so invalid,
  unsafe, corrupt, and migration-required states produce actionable results.
- The intended 0.2.0 npm package includes prebuilt ESM JavaScript, TypeScript
  declarations, the `ariadne` binary, and the canonical Ariadne, Codebase
  Design, Grilling, and Domain Modeling skills.

### Release verification

- The intended release path is a matching `v0.2.0` tag through the GitHub
  Actions release workflow with npm provenance, registry propagation,
  dist-tag, signature, CLI, and evidence-bundle checks. These external checks
  remain pending while release publication is blocked.

### Migration and compatibility

- Run `ariadne migrate` for an existing 0.1.0 workspace before using mutating
  commands. The migration path preserves legacy data and refuses unsafe or
  ambiguous formats.
- The 0.1.0 prototype is intended for deprecation on npm after 0.2.0 is
  published. Upgrade to 0.2.0 and run `ariadne migrate`.
