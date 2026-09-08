# 18 — Route All Mutations Through the Hardened Persistence Protocol

**What to build:**
Make the hardened persistence protocol the only active path for every library and CLI mutation. The end-to-end mutation flow must acquire one workspace lock, validate before writing, append durable framed events, atomically update projections, and release ownership safely. Legacy and mixed-format workspaces must be rejected for mutation with the canonical diagnostic model.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Every public and CLI mutation uses the same root lock and journal protocol.
- [ ] The durable commit point is reached only after the journal write is synchronized successfully.
- [ ] Projection updates are staged and atomically replaced after the journal commit.
- [ ] Lock ownership is verified on release, and an active or ambiguous owner is never stolen.
- [ ] Legacy and mixed-format workspaces cannot be mutated through any entry point.
- [ ] Integration tests prove that the old persistence paths are no longer active.
- [ ] Failure outcomes and diagnostics match the approved persistence contract.
