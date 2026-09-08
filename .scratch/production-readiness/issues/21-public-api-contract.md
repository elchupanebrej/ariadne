# 21 — Resolve and Enforce the Public API Contract

**What to build:**
Resolve the conflicting public-surface counts in the approved specification and tests, then make the package expose exactly one intentional runtime and type contract. Removed prototype capabilities must stay private, while the supported error, graph, validation, profile, and CLI-facing types remain coherent and versioned.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] One authoritative runtime export list and one authoritative type export list are recorded in the specification.
- [ ] The implementation, declaration output, and export-surface tests agree with those lists.
- [ ] The canonical error type and diagnostic payload are usable from the public API.
- [ ] Prototype-only modules and accidental internal helpers are absent from the public package surface.
- [ ] Public API compatibility behavior is documented for supported callers.
- [ ] A clean consumer can import the supported API without source-tree or development-only dependencies.
