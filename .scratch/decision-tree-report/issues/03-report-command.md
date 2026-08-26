# 03 - Task: ariadne report command

Type: task
Status: resolved
Blocked by: 01, 02

## Question

Implement `ariadne report [FRAME-id] [--json]`: without an argument a forest of all roots, with an argument a single tree (DEC-RPT-08); edges with relation types (DEC-RPT-10); intermediate answers from resolved UNKs / EVD verdicts / DEC rationales (DEC-RPT-07); change log filtered to CAN/DEC/EVD/UNK/invalidations with action-reason-link steps (DEC-RPT-04); links to `.ariadne/cards/<ID>.md`; writes to `.ariadne/reports/<NN>-<slug from FRAME>.md` (DEC-RPT-05, DEC-RPT-11); all paths root-relative (DEC-RPT-06); gsd mirror (DEC-RPT-12). Format as approved by prototype 01. Tests per point.

Done criterion: on the current live graph the command emits a readable report, including the tree from FRAME-RPT-001 with DEC-RPT-01..13.

## Comments

### Implementation (2026-08-25)

- `src/cli/commands/report.ts` — renderer (`buildReport`, pure function over graph events) + runner `runReport`; command wired in `src/cli/index.ts`. Tests: `tests/cli/report.test.ts` (13 cases, TDD through the runCli seam + pure renderer). `scripts/proto-tree.mjs` deleted — the real command supersedes it; render sequence verified byte-for-byte against the prototype (147/147 render events identical).
- Usage: `node dist/cli/index.js report` (forest), `report FRAME-RPT-001` (single tree), plus `--json`. The report is written to `<storage root>/reports/<NN>-<slug>.md`, NN being a global counter over the directory (DEC-RPT-11); stdout = file contents.

### Deviations and refinements of DECs

- **DEC-RPT-08 (wording amendment):** root = a node never occurring as **source**, not "a node without incoming edges". In the live graph source sits below (depends on target), so literally "without incoming" would exclude FRAME-RPT-001 itself — its decisions point AT it. The intent (FRAME-rooted forest) implemented; the DEC wording should be amended at the card's next revision. Flagged earlier by the prototype (ticket 01, item 1); here fixed in code and comment.
- **Tombstone steps:** a node of decisive type with status REMOVED/INVALIDATED is marked `append` (decisive type wins), TOMBSTONE only for non-decisive types; behavior carried over from the prototype unchanged.
- **Log reason:** full text of `adversarial_critique || statement`, width-truncated (as in the prototype code and approved samples), not "first sentence" as ticket 01's prose says.

### Resolutions of map.md fog items

- **JSON schema:** minimal, follows the text form: `{file, mode: forest|tree, sections:[{root, reachable}], remainder_roots:[], change_log:{shown, appends}}`.
- **CTR cycles:** no special rendering — per 00-core a deductive cycle cannot exist in the graph (a cycle must become a CTR node), the back edge always hits `seen` and prints as the stub `<id> (rendered above)`; traversal terminates.
- **Should verify gate the report:** left out of scope (third fog item of map.md, "surfaces after T3") — untouched.

### Two deliberate fixes relative to prototype bytes

1. A status without value prints `[ACTIVE]` instead of `[undefined]` (consistent with renderCard).
2. An unresolved UNK yields a single answer marker `~ UNRESOLVED` instead of double `~ ~ UNRESOLVED`.

### Evidence

- Tests: full suite 577 passed / 56 files (including 13 new); `npx tsc --noEmit` clean.
- Strict gate on the live overlay: `node dist/cli/index.js gate all --strict` → passed, diagnostics [].
- Live graph: forest = 5 TREE sections + REMAINDER (143 nodes, 66 local roots) + log `177 of 277 appends shown` (exactly as the prototype); `report FRAME-RPT-001` contains DEC-RPT-01..13; width — the single 100-column overflow is 107 characters, same known ceiling as recorded in ticket 01 (ponytail comment in code).
