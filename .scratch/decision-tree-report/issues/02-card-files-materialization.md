# 02 - Task: Materialize per-card markdown files

Type: task
Status: resolved

## Question

In `GraphStorage`, on every node write (in the same transaction that writes INDEX.md), generate a card file `.ariadne/cards/<ID>.md` from the graph node: header with status/provenance/revision date, body with statement and payload as readable markdown (DEC-RPT-02). On removal/invalidation the file is kept, only the status header updates (DEC-RPT-09). For pre-existing nodes — a one-time regeneration (like regenerateIndex). Gsd mode writes to `.planning/ariadne/cards/` (DEC-RPT-12). Tests for creation, update, tombstone, and the gsd mirror.

Done criterion: after any `ariadne node add/update/remove` and `ariadne invalidate`, files under cards/ agree with the materialized graph.

## Comments

- 2026-08-25 (agent): Implemented in `GraphStorage` (src/graph/storage.ts): `renderCard(node)` renders the header (Status/Provenance/Type/Revised) + Statement + Payload (json block of remaining fields); card writes happen inside `transaction()` right after INDEX.md under the same file lock, so every path (`node add/update/remove`, `invalidate`, `appendEvents`) is consistent automatically. One-time regeneration folded into `regenerateIndex()` (called from init). Gsd mirror comes free: cardsDirectory = `<storageRoot>/cards`, and in gsd mode storageRoot = `.planning/ariadne` (DEC-RPT-12, single logic). Tombstone: the file is never deleted, rewritten with the new REMOVED/INVALIDATED status (DEC-RPT-09).
- 2026-08-25 (agent): Tests tests/graph/cards.test.ts — 5 cases: creation, body+status update, tombstone (REMOVED and INVALIDATED), gsd mirror `.planning/ariadne/cards`, regeneration for pre-existing nodes. Full suite 564 passed (55 files), tsc --noEmit clean, `gate all --strict` green.
- 2026-08-25 (agent): A regeneration pass was run for existing repo nodes — `.ariadne/cards/` (180 cards) committed following the INDEX.md precedent (materialized views are tracked); INDEX.md content unchanged by it.
