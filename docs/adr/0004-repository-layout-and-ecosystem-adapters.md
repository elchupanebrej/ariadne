# 0004. Repository Layout and Ecosystem Adapters

## Context and Decision
Ariadne must maintain tight integration with GSD and Matt Pocock Skills while remaining standalone-capable. We decided on:
1. **Single Root Project Layout**: `src/` for TypeScript core & CLI, `skills/ariadne/` (and `.agents/skills/ariadne/`) for markdown skills and rules, `docs/` for specifications and ADRs.
2. **Auto-detection with Override**: The CLI automatically discovers `.planning/` and `gsd-sdk` to activate GSD mode and project state to `.planning/ariadne/`, with optional overrides via `ariadne.config.yaml` or CLI flags.
3. **Two-Tier Matt Skills Normalization**: Rule handoffs in `rules/matt-modules.md` paired with `ariadne ingest` commands to parse external skill outputs directly into epistemic graph nodes (`EVD-`, `EVDREQ-`).

## Consequences and Trade-offs
- Keeps codebase overhead minimal without multi-package orchestration.
- Enables zero-configuration interoperability in standard GSD/Matt Pocock workspaces.
