# Research filesystem durability and process coordination

Type: research
Status: resolved
Assignee: filesystem_durability
Research branch: research/production-filesystem-durability
Blocked by: None
Parent: [Ariadne production readiness](../map.md)

## Question

Using official Node.js documentation, operating-system documentation, and primary filesystem specifications, what guarantees can Ariadne rely on for local-file rename, append, flush, directory durability, lock-directory ownership, process death, and stale-lock recovery across the supported platforms? Identify which guarantees are portable, which require explicit synchronization, and which cannot be promised without changing the persistence substrate.

## Comments

- 2026-09-06: Claimed on `research/production-filesystem-durability`; limited the contract to cooperating processes on one machine and local filesystems.
- 2026-09-06: Resolved from current Node.js documentation/source, POSIX.1-2024, Linux man-pages, Apple system documentation, and Microsoft Win32 documentation.

## Answer

[Filesystem durability and process coordination](../../../docs/research/filesystem-durability-and-process-coordination.md)
finds that Ariadne can portably guarantee process-crash consistency by using one
root `mkdir` lock, one flushed canonical journal, recoverable transaction
framing, and rebuildable projections. Lock age is not ownership: automatic
recovery is safe only when the recorded owner process is definitely absent;
ambiguous or ownerless locks must fail closed. Universal power-loss durability,
portable atomic multi-file commits, and safe timeout-based lock stealing cannot
be promised through Node's documented filesystem API alone.
