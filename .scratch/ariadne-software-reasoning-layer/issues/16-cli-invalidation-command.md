# 16 — CLI invalidation command (ariadne invalidate)

**What to build:** CLI command `ariadne invalidate <node_id> --by <evidence_id>` executing transitive invalidation and outputting the affected downstream node cascade.

**Blocked by:** 09 — Transitive invalidation cascade engine, 15 — CLI edge management commands (ariadne edge)

**Status:** ready-for-agent

- [ ] `ariadne invalidate` traces all downstream invalidated nodes and prints the affected cascade
- [ ] Persists invalidation status to `GRAPH.jsonl` and updates `STATE.yaml`
- [ ] Returns non-zero exit code on missing node ID or invalid evidence reference
