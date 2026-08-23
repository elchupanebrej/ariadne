# 10 — Run Ariadne through the shared owner lifecycle contract

**What to build:** Allow an Orchestration Attempt to invoke a pinned Ariadne preflight, graph, ingest, gate, invalidation, or handoff operation through the shared lifecycle surface while Ariadne remains the sole validator and mutator of its Epistemic Overlay.

**Blocked by:** 09 — Run a Matt skill through the owner lifecycle contract.

**Status:** ready-for-agent

- [ ] Capability negotiation declares supported Ariadne operations, lifecycle behavior, versions, and required owner artifacts.
- [ ] Start, resume, cancel, and events exchange pointers and normalized lifecycle data without copying graph payloads.
- [ ] Only Ariadne validates and applies graph mutations, gates, invalidations, and handoff results.
- [ ] Invalid operations, pins, receipts, cursors, or owner bindings fail closed before Epistemic Overlay mutation.
- [ ] A direct Ariadne result can join an attempt through a validated owner receipt and artifact pointer.
- [ ] The owner-neutral integration stays separate from Ariadne's controller and preserves direct Ariadne use.
