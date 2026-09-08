# Decide the public interface and compatibility policy

Type: grilling
Status: resolved
Blocked by: 01
Parent: [Ariadne production readiness](../map.md)

## Question

Which TypeScript exports, CLI commands and exit codes, package binaries, bundled skills, Git integration behavior, and adapter contracts are public promises for the first production release? Decide what remains internal, the one permitted pre-1.0 breaking change, deprecation rules, semantic-versioning expectations, and how compatibility is verified from a clean external consumer rather than from repository-internal imports.

## Comments

- 2026-09-07 — Grilling round 1: the user accepted the recommended coordinated `0.2.0` contract reset, explicit public allowlist, stable SemVer/deprecation policy, and packed clean-consumer compatibility authority.
- 2026-09-07 — Grilling round 2: the user accepted the recommended TypeScript module categories, canonical CLI and exit-code contract, four-skill package, internal worktree implementation, and shared-only public adapter interface.
- 2026-09-07 — Grilling round 3: after interface inspection, the user accepted removing the speculative harness controller and adapter lifecycle seams, self-contained bundle pin resolution, uniform skill checks, and additive-only structured-data evolution.
- 2026-09-07 — Grilling round 4: the user accepted the ESM-only single-entry package, exact TypeScript allowlist and deep `EpistemicGraph` interface, and tarball-only compatibility release gate.

## Answer

### Compatibility baseline and evolution

`0.2.0` is the one permitted pre-1.0 contract-reset release. It replaces the accidental `0.1.0` exposure with the explicit Release Compatibility Contract below; every removal and behavior change is listed in the release notes. After `0.2.0`, Ariadne follows stable Semantic Versioning even while the package remains below 1.0: compatible additions are minor, fixes are patch, and removals or incompatible behavior require a major release.

A public feature is deprecated for at least one minor release before removal, using TypeScript `@deprecated` annotations, documentation, and CLI warnings where applicable. A security or data-integrity defect may instead fail closed immediately with an advisory. Persisted-Format Version and Merge Protocol Version remain independent of package version.

Optional object fields may be added compatibly in a minor release, and consumers must ignore unknown fields. Removing a field, changing its type or meaning, adding a required field, or extending a closed discriminant or outcome vocabulary is breaking and, for independently versioned wire formats, also requires the corresponding protocol-version change. Unknown discriminants fail closed.

### Package module interface

The npm package is Node-only and ESM-only. It publishes TypeScript declarations, named exports, and one root `"."` entrypoint. It promises no CommonJS loader, default export, browser runtime, or public subpath imports.

The root entrypoint exposes exactly these runtime values:

```text
NODE_TYPES, PROVENANCE_TYPES, TRANSITION_LIFECYCLE
NodeIdSchema, NodeTypeSchema, ProvenanceTypeSchema
TransitionLifecycleSchema, NodeSchemas, NodeSchema
EDGE_TYPES, EdgeTypeSchema, EdgeSchema
AriadneEpistemicEnvelopeSchema, exportEnvelopeJsonSchema
StateSchema
EpistemicGraph, EpistemicGateEngine
MethodContractSchema
validateMethodContract, resolveMethodContract
resolveProfile, checkProfileCompletion
runCli
```

It exposes exactly these type-only names:

```text
Node, NodeId, NodeType, ProvenanceType, TransitionLifecycle
EdgeType, EpistemicEdge, AriadneEpistemicEnvelope
AriadneState, MaterializedGraph
NodeFilter, EdgeFilter, InvalidationTraceEntry
ReportOptions, ReportOutput, ReportSummary
GateName, GateCommand, GateDiagnostic, GateResult, GateReceipt
GateVerificationOptions
MethodContract, MethodContractPin
ValidateMethodContractOptions, MethodContractValidationResult
ResolvedProfile, ProfileCompletionState, ProfileCompletionResult
RunCliOptions
```

`EpistemicGraph` is the deep public graph module. Its public interface comprises `open`, `inMemory`, initialization, materialization and state reads, frontier and node/edge queries, index rendering, node/edge mutation, invalidation, gates, and reports. Its constructor, storage driver, concrete storage classes, and storage paths are implementation details. `runCli` returns the same public exit classes as the installed binary and supports injected working directory and output streams through `RunCliOptions`.

Everything not listed is unavailable from the package root. In particular, concrete storage drivers, command handlers, migration and notice writers, capability detection, concrete adapters, adapter lifecycle types and pointer helpers, `WorktreeManager`, merge implementation functions, low-level helpers, `AriadneHarnessController`, and `createHarnessController` are internal. The controller and adapter seams may become public only after a distinct owner-neutral interface exists and a real external adapter passes conformance tests.

### CLI interface

The only installed binary is `ariadne`; the undocumented `ariadne-reasoning` alias is removed in `0.2.0`. The public commands are:

```text
init, status, node, edge, invalidate, gate, verify, ingest,
report, viz, template, merge-driver, merge-resolve, merge-setup,
merge-doctor, merge-check, merge-sync
```

`op` and the transport-free `envelope` commands are removed in the reset. `init` operates on the current working directory, as its command grammar states. The displayed CLI version derives from package metadata.

Command and option names, required operands, JSON shapes, stdout/stderr roles, and exit semantics are public. Exact human-readable prose is not. Structured stdout contains one parseable JSON value. Exit status `0` means successful completion or help; `1` means a valid invocation completed with a negative domain verdict; `2` means invalid invocation, invalid input, configuration or permission failure, or another runtime failure. The error-and-diagnostics decision may refine categories and payload fields without changing these three classes.

### Packaged skills

The tested package bundles `ariadne`, `methodize`, `methodize-ariadne`, and `methodize-harness`. Their public contracts include skill names, `SKILL.md` entrypoints and invocation mode, required relative artifacts, routing targets, and runnable-check behavior; compatible instructional prose may change.

Every declared pin resolves inside the exact tested tarball, either within its skill or through another skill's stable bundle name. Repository-only paths, mutable `latest` references, and duplicated source trees are forbidden. Each skill provides `example/check.mjs`, exits `0` on success and nonzero on failure, and ends successful output with `All verification checks passed!`. The `ariadne` check validates its router, referenced rules, and installed CLI integration without duplicating the teaching example. Repository linking scripts remain internal.

### Git, worktrees, and adapters

The public Git contract is the independently versioned Merge Protocol, Merge Receipt shapes and closed outcomes, managed-file behavior, repository-local setup, safe refusal of incompatible existing configuration, fresh-clone recovery, and the six `merge-*` commands. Setup does not alter global Git configuration or history; conflicts and unsupported operations fail without partial overwrite. Hooks are repository-local and non-blocking when the binary is unavailable, while emitting repair guidance.

`WorktreeManager`, its classes, path/branch layout, and concrete adapter implementations are not compatibility promises. They remain subject to production safety and invariant tests, but not Semantic Versioning until a documented consumer interface is deliberately published. No adapter interface is public in `0.2.0`; the public `ingest` CLI is the supported ecosystem seam.

### Compatibility evidence

Publication is blocked unless one SHA-256-pinned `npm pack` tarball passes from empty external consumers with no source-tree imports or repository dependencies:

1. Assert the exact runtime and type allowlists; reject removed names and subpath imports.
2. Exercise every public `EpistemicGraph`, gate, Method Contract, and `runCli` operation through installed JavaScript and declarations.
3. Exercise the installed `ariadne` binary, all public help grammars, representative successful, negative-verdict, and error paths, structured output, and exit statuses `0`, `1`, and `2`.
4. Resolve and run all four packaged skill checks wholly from installed content.
5. In temporary real Git repositories, verify Merge Protocol setup, doctor, idempotency, incompatible-configuration refusal, fresh-clone recovery, clean/diverged/failed merges, conflict safety, hooks, and deterministic receipts.
6. Run the artifact on the supported Node and operating-system matrix already selected by the runtime decision.

The exact expected interface lives in one checked-in external-consumer compatibility fixture, not an additional runtime manifest. Repository-internal imports remain useful implementation tests but cannot satisfy this release gate.
