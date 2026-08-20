# 05 — Atomic file storage manager (STATE.yaml and GRAPH.jsonl)

**What to build:** Storage engine managing atomic read/write operations for `.ariadne/STATE.yaml` and append-only event logging for `.ariadne/GRAPH.jsonl` with concurrency safety and schema validation.

**Blocked by:** 02 — Zod schemas for canonical epistemic nodes, 03 — Provenance lattice algebra and directed edges

**Status:** ready-for-agent

- [ ] Atomic writes for `STATE.yaml` prevent partial/corrupted files
- [ ] `GRAPH.jsonl` writes are append-only and stream-parseable
- [ ] State persistence and recovery survive process restarts and simulated crashes
