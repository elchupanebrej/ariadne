# Decide the security and trust-boundary contract

Type: grilling
Status: resolved
Blocked by: None
Parent: [Ariadne production readiness](../map.md)

## Question

Within the agreed trusted-host model, which filesystem paths, graph records, state overlays, imported artifacts, Git metadata, environment values, and CLI arguments cross a trust boundary? Decide validation and path-containment rules, symlink treatment, resource limits, command-execution ownership, secret-handling expectations, dependency policy, and the exact security properties Ariadne does and does not claim.

## Answer

Ariadne's security contract guarantees input validation, filesystem containment, protection of Ariadne-owned invariants, and fail-closed behavior at trust boundaries. It does not promise sandboxing, confidentiality, caller authentication, or protection against a hostile process that can mutate paths between validation and use. The supported multi-process model is cooperative processes on one machine.

The library may accept an explicitly selected storage root wherever the host permits access, but every access must remain beneath that root. CLI discovery is restricted to `.ariadne` or `.planning/ariadne` beneath the detected workspace. Missing roots may be created only beneath an already contained parent. Existing paths are canonicalized; symlink targets are allowed only when they remain inside the boundary, and escapes or unexpected non-regular file types are rejected. `--force` may replace only known managed files after these checks and never arbitrary user files.

Graph records, state overlays, envelopes, imported artifacts, Git metadata, CLI arguments, and environment-derived values are untrusted inputs. They are schema-validated and bounded before use; imported content is inert data and cannot select commands, paths, or permissions. Git is invoked only through fixed direct argv operations and its output is treated as untrusted text. Runtime behavior uses declared packaged dependencies and bundled skills only: no dynamic install, download, evaluation, or execution of imported/package content.

Only an explicit user or owning integration command may execute. Commands use direct argv spawning with `shell: false`, inherited host environment, bounded output, and timeout/abort handling. Environment values are never persisted. Persisted command evidence contains only bounded, best-effort redacted output; raw output is available only in memory to the immediate caller, with no raw-output override. Ariadne makes no confidentiality promise for repository artifacts and relies on host/repository permissions.

`merge-setup` may write only Ariadne's fixed hook content and may not execute repository-provided hook text. Hook synchronization failures must be reported as failures rather than silently represented as success. Exact supported resource budgets remain the responsibility of `09-decide-capacity-and-performance`; exceeding any declared safety cap fails before mutation or command execution.
