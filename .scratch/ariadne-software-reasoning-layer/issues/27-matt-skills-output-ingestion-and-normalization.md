# 27 — Matt skills output ingestion and normalization

**What to build:** Ingestion parser that normalizes outputs from Matt model-invoked skills (`diagnosing-bugs`, `prototype`, `research`, `tdd`, `domain-modeling`, `codebase-design`, `code-review`) into typed `EVD-` and `EVDREQ-` graph nodes.

**Blocked by:** 02 — Zod schemas for canonical epistemic nodes, 03 — Provenance lattice algebra and directed edges

**Status:** ready-for-agent

- [ ] Parses red-capable test artifacts from `diagnosing-bugs` into `MEASURED` evidence nodes
- [ ] Normalizes prototype and research outputs into typed hypothesis verification results
- [ ] Integrates cleanly with CLI `ariadne ingest matt <skill> <file>` command
