# 02 — `ariadne edge add` does not list the valid relations in the error or the help

**What does not work:** the `ariadne` CLI rejects unknown edge relation names with `Invalid edge relation: <rel>`, a message that does not enumerate the valid relations; the relation dictionary appears nowhere in the help or docs. Discoverability requires reading the sources.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Details

- **Reproduction:** `ariadne edge add X raises Y` → `Error: Invalid edge relation: raises` (src/cli/commands/edge.ts:57, src/graph/epistemic-graph.ts:293).
- **Actual dictionary — 12 relations** (corrects the original report, which claimed only `depends_on` and `references` are accepted): supports, contradicts, depends_on, derived_from, answers, tests, falsifies, invalidates, satisfies, violates, supersedes, references (src/core/schemas/edges.ts:9), plus the aliases `depends-on`/`dependsOn`/`derived-from`/`derivedFrom`.
- **Why the original reporter's brute force gave a false result:** besides the relation-name check there is an endpoint contract (EDGE_ENDPOINT_CONTRACTS, src/core/schemas/edges.ts:78) — a valid relation name with an incompatible pair of node types is rejected with a *different* message. From FRAME to FRAME, supports, contradicts, depends_on, derived_from, supersedes and references all work.
- **Impact correction:** "FRAME raises UNK" is expressible — `depends_on` is allowed for FRAME→UNK; `raises` is simply not in the dictionary.
- **Proposed fix:** include `EDGE_TYPES.join(", ")` in the `Invalid edge relation` message and in the `ariadne edge add --help` usage. Extending the dictionary (`raises`, etc.) is a separate decision, not part of this defect.

## Acceptance criteria

- [ ] `ariadne edge add X <unknown-rel> Y` prints the list of valid relations
- [ ] The relation dictionary is visible in the help of the `edge add` subcommand
- [ ] An endpoint-contract violation is distinguishable from an unknown relation-name error

## Comments

- Transferred from succubus `.scratch/ariadne-cli-defects/issues/02-edge-add-ne-perechislyaet-dopustimye-svyazi.md` after validation (2026-09-03): the discoverability core was confirmed, but the facts about the relation dictionary and "FRAME→UNK inexpressibility" were wrong — corrected here. Status raised to ready-for-agent.
- Fixed in commit ac93927: `unknownEdgeRelation` helper built from `EDGE_TYPES` used at all three throw sites (`edge add`/`remove` via epistemic-graph, `edge list --relation`); relation list added to `edge add --help`; endpoint-contract path untouched and remains a distinct error.
