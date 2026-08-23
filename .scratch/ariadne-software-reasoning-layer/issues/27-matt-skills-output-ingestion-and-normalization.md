# 27 — Matt skills output ingestion and normalization

**What to build:** Ingestion parser that normalizes outputs from Matt model-invoked skills (`diagnosing-bugs`, `prototype`, `research`, `tdd`, `domain-modeling`, `codebase-design`, `code-review`) into typed `EVD-` and `EVDREQ-` graph nodes.

**Blocked by:** 02 — Zod schemas for canonical epistemic nodes, 03 — Provenance lattice algebra and directed edges

**Status:** resolved

- [ ] Parses red-capable test artifacts from `diagnosing-bugs` into `MEASURED` evidence nodes
- [ ] Normalizes prototype and research outputs into typed hypothesis verification results
- [ ] Integrates cleanly with CLI `ariadne ingest matt <skill> <file>` command

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: adapters/matt/ingest.ts typed SUPPORTED/FALSIFIED/INCONCLUSIVE across 7 skills; ariadne ingest matt CLI; matt tests. Full suite green (53 files / 557+ tests), typecheck clean.
