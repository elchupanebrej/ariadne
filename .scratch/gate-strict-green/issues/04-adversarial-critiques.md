# 04 — Adversarial critiques for locked decisions

**What to build:** Each decision the strict epistemic gate flags as `MISSING_ADVERSARIAL_CRITIQUE` receives a substantive adversarial critique before remaining locked: attacks on complexity shifts, hidden mutable state, ownership gaps, degraded modes, and transition risk — with responses, per Operation 80's selection procedure. No empty strings; no restating the decision as its own critique.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Zero `MISSING_ADVERSARIAL_CRITIQUE` diagnostics from `node dist/cli/index.js gate all --strict` at the repo root
- [ ] Each critique names at least one concrete attack (failure mode, cost shift, or ownership gap) and its response
- [ ] Decisions stay locked only where their dependencies' provenance supports it

## Comments

`DEC-semantic-gate-preflight-contract` was the only flagged node. Added a substantive critique via `ariadne node update`: attack on preflight/gate rule drift and on callers treating preflight as gate-skipping license; response grounded in the pure single-source helper and preserved invariants; falsification condition recorded (preflight/gate disagreement reopens the decision). Repo-root strict gate now reports zero diagnostics.
