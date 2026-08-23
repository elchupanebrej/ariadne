# 04 — Epistemic message envelope schema and JSON schema export

**What to build:** Structured communication envelope schema for multi-agent reasoning message exchange, including role types, epistemic mode, and typed provenance payloads, with standard JSON Schema draft-2020-12 export.

**Blocked by:** 03 — Provenance lattice algebra and directed edges

**Status:** resolved

- [ ] `AriadneEpistemicEnvelope` Zod schema validates message payloads across sender and target roles
- [ ] Export utility generates compliant JSON Schema draft-2020-12 matching Spec v5 Section 11
- [ ] Unit tests verify rejection of malformed envelopes or missing role headers

## Comments

Verified resolved against the current codebase during the ticket-16/17 release sweep: AriadneEpistemicEnvelope in schemas/envelope.ts; exportEnvelopeJsonSchema draft-2020-12 asserted; malformed-role rejection tested. Full suite green (53 files / 557+ tests), typecheck clean.
