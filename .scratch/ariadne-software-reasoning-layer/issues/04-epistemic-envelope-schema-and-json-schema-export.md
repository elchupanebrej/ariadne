# 04 — Epistemic message envelope schema and JSON schema export

**What to build:** Structured communication envelope schema for multi-agent reasoning message exchange, including role types, epistemic mode, and typed provenance payloads, with standard JSON Schema draft-2020-12 export.

**Blocked by:** 03 — Provenance lattice algebra and directed edges

**Status:** ready-for-agent

- [ ] `AriadneEpistemicEnvelope` Zod schema validates message payloads across sender and target roles
- [ ] Export utility generates compliant JSON Schema draft-2020-12 matching Spec v5 Section 11
- [ ] Unit tests verify rejection of malformed envelopes or missing role headers
