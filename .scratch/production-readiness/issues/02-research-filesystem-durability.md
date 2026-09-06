# Research filesystem durability and process coordination

Type: research
Blocked by: None
Parent: [Ariadne production readiness](../map.md)

## Question

Using official Node.js documentation, operating-system documentation, and primary filesystem specifications, what guarantees can Ariadne rely on for local-file rename, append, flush, directory durability, lock-directory ownership, process death, and stale-lock recovery across the supported platforms? Identify which guarantees are portable, which require explicit synchronization, and which cannot be promised without changing the persistence substrate.
