# 01 - Prototype: ASCII tree and change-log grammar

Type: prototype
Status: resolved

## Question

What exactly does the report's ASCII grammar look like: a tree from the root FRAME with all nodes, type labels on edges, intermediate answers at nodes, a filtered change log? Build a cheap mock render over the live `.ariadne/GRAPH.jsonl` graph (a throwaway script is fine) and let a human react.

Builds on: DEC-RPT-03 (whole graph), DEC-RPT-04 (log filter), DEC-RPT-07 (answers from existing nodes), DEC-RPT-10 (edge labels), CTR-RPT-01/ASM-RPT-02 (readability — what we are testing).
The result closes the fog item about the JSON schema: the text form is primary, JSON follows it.

## Answer

Script: `scripts/proto-tree.mjs` (throwaway but committed for re-runs; `node scripts/proto-tree.mjs [--selfcheck]`).

**Grammar (fixed by this prototype):**

1. **Orientation.** In the live graph every edge reads "source depends on / is derived from target", i.e. source sits below. Children of node X = sources of edges with target=X. Root = a node that never occurs as source. This refines DEC-RPT-08's wording ("root without incoming structural edges"): taken literally it would exclude FRAME-RPT-001 itself, because its own decisions point AT it. Note to orchestrator: DEC-RPT-08's wording should be amended when materializing the report command.
2. **Sections.** Forest by root FRAMEs (DEC-RPT-08), each section = the full subtree (DEC-RPT-03). Nodes unreachable from any FRAME root form a REMAINDER section from their own local roots. A repeated node inside a section prints fully once, then as the stub `<id> (rendered above)`.
3. **Node line:** `<prefix>` + `` `-- `` or `` |-- `` + `<edge-type>` + ` --> ` + `<ID>` + ` [STATUS] ` + truncated title. Target ≤100 columns; title truncates into the remaining budget (ellipsis `\u2026`); if no room remains the line prints without a title.
4. **Edge labels** (DEC-RPT-10): full relation-type text — `derived_from`, `references`, `depends_on`, `supports`, `satisfies`, `tests`, `answers`, `violates`, `falsifies`. No abbreviations needed: full words read well and fit.
5. **Step answer** (DEC-RPT-07): the line beneath the node with the same continuation prefix, marker `~ `. The answer derives from an existing node field: UNK → `resolved by <DEC-id>`, else `~ UNRESOLVED`; EVD → `verdict: <verdict>`; others → first sentence of statement. A missing answer is honestly visible (`~ UNRESOLVED`), not masked.
6. **Depth.** Past 24 columns of prefix the subtree closes with an `... ` marker and continues as a separate block `-- subtree continued: <type> --> <ID> --` from column zero after the current block. One known ceiling: single lines may exceed 100 columns via their fixed part (long id at great depth), max 107 in the live graph; marked `ponytail:` in the script.
7. **Change log** (DEC-RPT-04): events = appends of CAN/DEC/EVD/UNK nodes plus transitions to REMOVED/INVALIDATED (tombstones), in file (chronological) order, no folding. Each step is three lines: `[NNN] <append|TOMBSTONE> <ID> -> <status>`, link to the card `.ariadne/cards/<ID>.md`, reason (first sentence of adversarial_critique, else statement). The filter showed 177 of 277 appends (~64%): 165 decisive + 12 tombstones. Cards do not exist yet (ticket 02) — paths print per the DEC-RPT-02 contract.

**Testable hypothesis CTR-RPT-01/ASM-RPT-02:** the full graph (180 unique nodes — larger than the expected "124+") stays readable: 1924 output lines, all lines within budget except one stub. Sections + width limits + repeat dedup work. ASM-RPT-02 not falsified.

### Sample render (this effort's whole tree)

```
== TREE 1: FRAME-RPT-001 (17 nodes reachable) ==
FRAME-RPT-001 [ACTIVE] Research decision-tree report artifact
~ At the end of an investigation ariadne produces: a traversal tree from the posed problem, intermedi…
|-- references --> ASM-RPT-01 [ACTIVE] Why-log reconstructable only if rationale is recorded
|    ~ The why-log reconstructs why only if the rationale is recorded in the card at the moment of ch…
|-- references --> ASM-RPT-02 [ACTIVE] Full-graph ASCII readable at realistic scale
|    ~ The full graph stays readable in ASCII at a realistic scale of dozens of active nodes, given s…
|-- references --> CTR-RPT-01 [RESOLVED] Completeness versus readability of full-graph tree
|    ~ Tree completeness versus ASCII readability on large graphs.
|-- derived_from --> DEC-RPT-01 [DECIDED] Delivery: CLI renders, skill mandates embedding
|    ~ Option c chosen: the ariadne report command renders the report deterministically from the grap…
|-- derived_from --> DEC-RPT-02 [DECIDED] Card files materialized per node
|    ~ Option a chosen: every node write generates a .ariadne/cards/<ID>.md file (like INDEX.md) and …
|-- derived_from --> DEC-RPT-03 [DECIDED] Tree shows full graph
|    ~ Option c chosen: the tree shows the whole graph with all nodes, not just the selected path or …
|-- derived_from --> DEC-RPT-04 [DECIDED] Change log filtered to decision-relevant events
|    ~ Option a with filter chosen: the change log includes events of decisive types CAN, DEC, EVD, U…
|-- derived_from --> DEC-RPT-05 [DECIDED] Reports persisted as numbered history
|    ~ Option b chosen: reports persist under .ariadne/reports/<NN>-<slug>.md as history.
|-- derived_from --> DEC-RPT-06 [DECIDED] Root-relative paths invariant for emitted artifacts
|    ~ Option b repo-wide chosen: every artifact ariadne writes or prints normalizes paths relative t…
|-- derived_from --> DEC-RPT-07 [DECIDED] Intermediate answers derived from existing nodes
|    ~ Option a chosen: a step's intermediate answer is derived from existing nodes - a resolved UNK…
|-- derived_from --> DEC-RPT-08 [DECIDED] Forest by default, single tree by argument
|    ~ Chosen: without an argument the report renders a forest of all root FRAMEs, with an argument …
|-- derived_from --> DEC-RPT-09 [DECIDED] Tombstoned cards keep their file
|    ~ Option a chosen: on removal or invalidation the card file is kept, its header updated to INVA…
|-- derived_from --> DEC-RPT-10 [DECIDED] Edge types rendered on tree edges
|    ~ Yes chosen: each tree edge prints its relation type, e.g. derived_from or supersedes, because…
|-- derived_from --> DEC-RPT-11 [DECIDED] Report slug from root frame id
|    ~ Option a chosen: the report slug derives from the root FRAME id, e.g. 001-frame-login-retry.md.
|-- derived_from --> DEC-RPT-12 [DECIDED] GSD mode mirrors cards and reports
|    ~ Yes chosen: in gsd mode cards and reports live mirrored under .planning/ariadne/cards…
`-- derived_from --> DEC-RPT-13 [DECIDED] ASCII spiral wording replaced by defined artifact
     ~ Yes chosen: the mention of an undefined ASCII spiral in SKILL.md is replaced by a defined artif…
```

### Deep subtree + re-anchor (TREE 2/REMAINDER, fragment)

```
|         |-- violates --> CAN-author-guided-demonstration-evaluation [REJECTED] Author-guided demo…
|         |    ~ Let the methodology author guide a session through the worked examples and judge w…
|         |    `-- references --> VAL-SELECT-clean-session-verification [SELECTED] Select matched c…
|         |         ~ A non-compensatory filter selects matched held-out Clean-Session Runs and rej…
|         |         `-- derived_from --> DEC-clean-session-verification-contract (rendered above)
...
-- subtree continued: derived_from --> DEC-matt-ariadne-adapter-contract --
DEC-matt-ariadne-adapter-contract [PROVISIONAL] Pointer-only Matt and Ariadne adapter contracts
~ Coordinate Matt Pocock Skills and Ariadne through one five-operation pointer-only lifecycle surfa…
|-- depends_on --> CTR-continuity-vs-authority-boundary (rendered above)
|-- depends_on --> DEC-clean-session-verification-contract (rendered above)
`-- references --> OBS-adapter-contract-post-evidence-gate [OBSERVED] Adapter-contract task-local g…
     ~ After lowering the dependency card to the strongest provenance expressible by the current ed…
```

### Change log (fragment)

```
== CHANGE LOG (filter: appends of CAN/DEC/EVD/UNK + tombstones; 177 of 277 appends shown) ==
[  2] append UNK-uncertainty-trigger-boundary -> OPEN
       .ariadne/cards/UNK-uncertainty-trigger-boundary.md
       Which observable task signals are sufficient to activate Ariadne before downstream work?
[ 56] append DEC-uncertainty-interaction-contract -> DECIDED
       .ariadne/cards/DEC-uncertainty-interaction-contract.md
       The preflight keeps the substrate in Ariadne, avoids host-specific wrapper coupling, and pre…
[ 80] append UNK-semantic-preflight-placement -> RESOLVED
       .ariadne/cards/UNK-semantic-preflight-placement.md
       Which seam should own candidate-breadth preflight diagnostics: a pure semantic-gate…
[108] TOMBSTONE VAL-SELECT-methodological-harness-defaults -> REMOVED
       .ariadne/cards/VAL-SELECT-methodological-harness-defaults.md
       Layering can become duplicated documentation,Self-application can become circular self-justi…
```

**Conflicts with DECs:** one, mild — DEC-RPT-08's literal root wording contradicts the live graph's actual edge orientation (see item 1); the prototype fixes the working rule, the human decides during T3 implementation. All other DECs honored; no spec.md exists in this effort's directory (map.md only) — did not affect the work.

**Human reaction pending**: the orchestrator collects the reaction to the grammar before T3; this answer is material for that reaction, not the final word.
