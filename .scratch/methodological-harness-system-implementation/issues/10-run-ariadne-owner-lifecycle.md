# 10 — Run Ariadne through the shared owner lifecycle contract

**What to build:** Allow an Orchestration Attempt to invoke a pinned Ariadne preflight, graph, ingest, gate, invalidation, or handoff operation through the shared lifecycle surface while Ariadne remains the sole validator and mutator of its Epistemic Overlay.

**Blocked by:** 09 — Run a Matt skill through the owner lifecycle contract.

**Status:** resolved

- [x] Capability negotiation declares supported Ariadne operations, lifecycle behavior, versions, and required owner artifacts.
- [x] Start, resume, cancel, and events exchange pointers and normalized lifecycle data without copying graph payloads.
- [x] Only Ariadne validates and applies graph mutations, gates, invalidations, and handoff results.
- [x] Invalid operations, pins, receipts, cursors, or owner bindings fail closed before Epistemic Overlay mutation.
- [x] A direct Ariadne result can join an attempt through a validated owner receipt and artifact pointer.
- [x] The owner-neutral integration stays separate from Ariadne's controller and preserves direct Ariadne use.

## Comments

Implemented `AriadneOwnerAdapter` in `src/adapters/ariadne/lifecycle.ts` mirroring the Matt adapter's lifecycle surface. Ariadne operations: `preflight`, `graph`, `ingest`, `gate`, `invalidation`, `handoff`. External run refs carry the `ariadne://run/<operation>-...` scheme. Completion requires `ariadne://`-scheme receipts (fails closed on `matt://` or missing). Graph revision pointers are validated to stay within the `ariadne://` scheme. 15 tests cover all 6 acceptance criteria.

