# 30 — Subagent delta envelope parser and merger (ariadne-delta)

**What to build:** Parser and merge engine for `ariadne-delta` JSON code blocks emitted by ephemeral role subagents, validating schemas before merging proposed node and edge mutations into `GRAPH.jsonl`.

**Blocked by:** 04 — Epistemic message envelope schema and JSON schema export, 05 — Atomic file storage manager

**Status:** ready-for-agent

- [ ] Extracts and parses ` ```json ariadne-delta ` blocks from subagent responses
- [ ] Validates delta payload against Zod schema and DAG constraints before merging
- [ ] Applies atomic graph mutations and updates `INDEX.md`
