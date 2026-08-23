# 03 — Disposition the orphaned evidence requests

**What to build:** Every evidence request in the repo-root overlay (`.ariadne/`) that the strict epistemic gate reports as `MISSING_EVIDENCE_RESULT` gets an honest disposition: link an existing evidence result if linkage fields were merely broken, produce a real result via a runnable check when the claim is cheaply testable today (e.g., r2/r3 prototype requests), or remove the request from the current graph state when it is aspirational work that cannot be honestly evidenced now (r5 mutation-testing, r6 conformance/transfer studies, r8 fault injection) — recording the rationale and provenance of each removal in this ticket's comments so nothing silently disappears.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Zero `MISSING_EVIDENCE_RESULT` diagnostics from `node dist/cli/index.js gate all --strict` at the repo root
- [ ] No fabricated receipts: every added EVD names an executed method, rung, verdict, receipt digest, and reproducible environment
- [ ] Each removed request has a written rationale in this file's Comments section
- [ ] The append-only spirit is respected: removals are justified as superseded/aspirational state cleanup, not history rewrites of other nodes

## Comments

Disposition of each removed request (all five were aspiration-only: no evidence result existed anywhere in the graph, by field linkage or answers edge; all demanded heavyweight studies not runnable today):

- `EVDREQ-clean-session-runtime-necessity` (r6) — removed. Requires matched thin-loader vs host-native runtime runs; study never executed.
- `EVDREQ-clean-session-validator-quality-r5` (r5) — removed. Requires mutation testing with MSI >= 85%; never executed.
- `EVDREQ-owner-adapter-clean-session-conformance-r6` (r6) — removed. Requires per-adapter conformance runs against production adapters; never executed.
- `EVDREQ-runtime-safety-recovery-r8` (r8) — removed. Requires real-boundary fault injection; never executed. Re-file as a fresh request when the runtime work actually starts.
- `EVDREQ-teaching-skills-clean-session-transfer-r6` (r6) — removed. Requires held-out matched-arm transfer experiments; never executed.

23 edges referencing these requests were dropped with them. No receipts were fabricated; git history retains the removed events. Post-edit strict epistemic gate reports zero MISSING_EVIDENCE_RESULT.

Deviation note (append-only): docs/TICKETS.md TICKET-201/202 prefer tombstone events, but a tombstoned node is still materialized as an EVDREQ and re-flagged by the epistemic gate (`applyEvents` keeps it; the gate filters only on type). With no cancelled-request representation, physical removal from current state is the only honest disposition; git history retains the events. Follow-up scrub: 11 active nodes had dead request IDs filtered from forward-looking pointer fields (`next_evidence_requests`, `required_evidence`, `required_evidence_requests`, `evidence_requests`); prose narratives and OBS records were intentionally left untouched.
