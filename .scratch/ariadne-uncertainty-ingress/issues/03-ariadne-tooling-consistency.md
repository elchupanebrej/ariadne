# 03 — Ariadne tooling consistency

**What to build:** Ariadne graph and handoff tooling preserves canonical relation semantics, keeps persisted frontier state synchronized with graph mutations, supports a pre-decision grill substrate, and records every internal tooling failure with its workaround and impact.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Canonical graph relations needed by transformation and value-selection artifacts are accepted or produce a semantically equivalent persisted relation without silent downgrade.
- [ ] Graph mutations update the persisted frontier and open-unknown state used by a new session.
- [ ] A pre-decision grill substrate can be produced while unknowns remain open and without requiring a locked decision.
- [ ] Tooling failures record the observed command/error, workaround, impact, and affected component as Ariadne observations.
- [ ] Existing structural, semantic, epistemic, and handoff behavior remains compatible.
