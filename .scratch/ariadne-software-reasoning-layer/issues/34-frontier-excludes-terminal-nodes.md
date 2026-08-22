# 34 — Frontier includes terminal nodes and hides unresolved work

Status: resolved

## Observed behavior

`STATE.yaml`, `ariadne status --json`, and `INDEX.md` treat nearly every node as frontier work. In the current graph, the reported frontier has 124 nodes while `open_unknowns` has 3. It includes, for example:

- `CAN-artifact-catalog-method-teaching` with status `REJECTED`
- `DEC-runtime-safety-recovery-contract` with provenance `DECIDED`
- `UNK-runtime-safety-recovery-semantics` with status `RESOLVED`

`INDEX.md` then sorts all such nodes by ID and renders the first 25. Those rows include rejected candidates but omit the still-open `UNK-auto-handoff-policy`.

This conflicts with ADR 0002, issue 06, and the uncertainty rule's use of *frontier* for unresolved epistemic work.

## Expected behavior

Frontier derivation excludes terminal nodes (`RESOLVED`, `REJECTED`, `INVALIDATED`, and `REMOVED`) and nodes whose provenance is already `DECIDED`. `STATE.yaml`, status output, and the index use the same rule. The index prioritizes true frontier rows before applying its compactness limit and reports when rows are omitted.

## Minimal reproduction

From the repository after a build:

```bash
rtk node dist/cli/index.js status --json
rtk read .ariadne/INDEX.md
rtk node dist/cli/index.js node get CAN-artifact-catalog-method-teaching
rtk node dist/cli/index.js node get UNK-auto-handoff-policy
```

The JSON frontier contains the rejected candidate. The first 25 index rows contain that candidate but not the open unknown.

## Likely source boundary

- `src/graph/storage.ts`: `stateForGraph()` excludes only `INVALIDATED` and `REMOVED`; `renderIndex()` excludes only `INVALIDATED` and slices the alphabetically sorted rows to 25.
- `src/cli/commands/status.ts`: `buildStatusReport()` trusts the persisted frontier and otherwise repeats the broad active-node rule.
- `tests/graph/index-generator.test.ts`, `tests/graph/storage.test.ts`, and `tests/cli/status.test.ts`: no terminal-status or over-25 frontier case.

## Acceptance checks

- [x] A fixture containing an open node, a resolved unknown, a rejected candidate, and a decided decision exposes only the unresolved node in state, status, and the index frontier.
- [x] An unresolved node that sorts after 25 terminal nodes remains visible in `INDEX.md`.
- [x] If more frontier rows exist than the compact limit permits, the index shows a deterministic omitted count rather than silently hiding them.
- [x] Existing automatic regeneration and the `< 500` token compact-index requirement still pass.

