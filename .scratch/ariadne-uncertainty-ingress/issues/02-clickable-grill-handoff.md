# 02 — Clickable recommended grill handoff

**What to build:** Grill-me and grill-with-docs receive Ariadne's epistemic substrate as a frontier summary whose questions contain recommended answers and directly openable links to the real persisted documents containing the referenced artifacts.

**Blocked by:** 01 — Uncertainty ingress preflight.

**Status:** ready-for-agent

- [ ] Every referenced artifact ID in a question, recommendation, resolution list, or handoff summary has an inline Markdown link.
- [ ] Every link href targets an existing persisted document that can be opened directly from the dialog; labels may show card IDs, but hrefs are never ID-only or invented per-card paths.
- [ ] Every frontier question includes an `➡️ Recommended answer` derived from an Ariadne selection or decision artifact.
- [ ] The handoff exposes facts, open unknowns, assumptions, contradictions, evidence, candidate mechanisms, provenance, and the current frontier without duplicating graph state.
- [ ] An explicit grill request receives Ariadne preflight first; specification, ticketing, and implementation remain human-controlled.
