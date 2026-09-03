# Specification: Three-Way Epistemic Model Merge for Git Branches

**Status:** ready-for-agent
**Triage:** ready-for-agent
**Decision basis:** ADR 0014; `DEC-merge-contract-confirmed`

## Problem Statement

Ariadne persists an Epistemic Graph as an append-only event log. Two Git
branches can therefore contain valid but different Branch Epistemic Models of
the same software work. A normal textual merge cannot determine whether their
materialized knowledge is independent, identical, or mutually incompatible.

The current graph materializer replaces an earlier node revision when a later
event uses the same node ID. Concatenating two branch logs would consequently
make event order choose a winner. One branch could silently overwrite the other,
and the resulting graph could also contain dangling references or a cycle in its
deductive edges. Treating every epistemic disagreement as an ordinary Git
conflict has the opposite failure mode: it prevents a developer from merging
otherwise valid code until an agent or human resolves every reasoning
difference.

Git has no hook that runs before its merge machinery and can semantically merge
three file versions. The `pre-merge-commit` hook runs only after Git has already
completed an automatic merge, and it does not run when normal file conflicts
remain. It is also locally bypassable. A hook alone therefore cannot preserve
both models or provide the required three-way semantics.

Ariadne needs a deterministic integration that uses the common ancestor, keeps
all non-conflicting knowledge, represents unresolved epistemic divergence
without choosing a branch, reports whether the models converged, and reserves a
hard Git conflict for cases where no valid lossless graph can be produced.

## Solution

Add a deterministic three-way Epistemic Graph merge and expose it through an
Ariadne CLI merge-driver entry point. Git supplies the common ancestor, current
branch, and incoming branch versions. Ariadne validates and materializes all
three, computes each branch delta from the common ancestor, combines compatible
events, and writes a valid merged event log back to Git's result file.

The merge has three outcomes:

- `CLEAN`: all branch changes were identical or compatible under the explicit
  identity and topology rules, and the merged graph has no detected merge
  contradiction. This does not claim arbitrary cross-ID semantic convergence.
- `DIVERGED`: Ariadne produced a valid lossless graph, but one or more changes
  could not be combined without choosing a branch. Each divergence is preserved
  as a deterministic unresolved `CTR-merge-*` node. This is a successful Git
  merge-driver outcome.
- `FAILED`: an input is malformed or no schema-valid and structurally valid
  output can preserve both materialized branch models. Ariadne leaves the result
  file unchanged and returns a non-zero status so Git reports a file conflict.

An unresolved merge contradiction stores the conflicting subject, the base
value when present, both complete materialized branch variants, their normalized
input digests and Git-provided source labels, and any materialized nodes or edge
states quarantined to keep the active graph valid. Raw branch event suffixes are
not copied into the contradiction; Git parent history remains their source. The
merge never promotes provenance, never grants decision authority, and never lets
branch ordering decide the result. A later agent or human resolves the
contradiction by appending a canonical revision and reconstituting any now-valid
quarantined knowledge; the historical contradiction remains in the append-only
graph with a resolved status.

Repository-scoped Git attributes select Ariadne's merge driver for the canonical
graph log. An idempotent Ariadne setup command configures the driver without
overwriting existing repository Git configuration. Optional
`pre-merge-commit` and `pre-commit` checks summarize unresolved contradictions,
and regenerate graph-derived projections. They never block a valid `DIVERGED`
result. A separate explicit check command lets CI or protected-branch policy
require reconciliation before publication without changing semantic merge.

## User Stories

1. As a developer, I want Git to invoke Ariadne automatically when both branches
   changed the Epistemic Graph, so that I do not have to locate and compare the
   model files manually.
2. As a developer, I want Ariadne to use the common ancestor as well as both
   branch versions, so that an unchanged value is not confused with a competing
   edit.
3. As a developer, I want independent nodes created on different branches to
   appear in the merged graph, so that both branches retain their reasoning.
4. As a developer, I want identical changes from both branches to be deduplicated,
   so that convergence does not create duplicate graph events.
5. As a developer, I want a change made on only one branch to be applied normally,
   so that ordinary branch work remains low-friction.
6. As a developer, I want incompatible revisions of the same node ID preserved
   without a last-writer winner, so that neither model is silently overwritten.
7. As a developer, I want an epistemically divergent but structurally valid
   result to remain mergeable, so that code integration is not blocked by work
   an agent can reconcile later.
8. As a developer, I want malformed or unsafe graph output to remain a real Git
   conflict, so that merge convenience never causes data loss.
9. As a developer, I want the CLI to print a concise human-readable outcome, so
   that I immediately know whether the models converged.
10. As a tool integrator, I want the same merge outcome available as structured
    JSON, so that hooks, CI, and agents do not parse prose.
11. As an autonomous agent, I want every unresolved branch divergence represented
    by a `CTR-merge-*` node, so that reconciliation work is discoverable through
    the normal Epistemic Graph frontier.
12. As an autonomous agent, I want a merge contradiction to contain the base,
    current-branch, and incoming-branch variants, so that I can compare the
    complete materialized models without first replaying Git history.
13. As an autonomous agent, I want branch source digests recorded with each
    variant, so that the reconciliation result is auditable and repeatable.
14. As an autonomous agent, I want dependent materialized nodes and edge states
    quarantined with their conflicting variant, so that the active graph remains
    valid without losing branch-local reasoning.
15. As an autonomous agent, I want to resolve a merge contradiction through one
    atomic compare-and-swap command, so that reconciliation reuses the Epistemic
    Graph Engine without exposing a partially resolved graph.
16. As an autonomous agent, I want a resolved merge contradiction to remain in
    history, so that later sessions can explain why the canonical model changed.
17. As a maintainer, I want merge conflict IDs derived deterministically from the
    conflict subject and normalized variants, so that re-running the merge does
    not create new contradictions.
18. As a maintainer, I want exchanging the current and incoming branch inputs to
    produce the same materialized graph and conflict identities, so that branch
    direction cannot encode hidden precedence.
19. As a maintainer, I want merge comparison to use each branch's materialized
    result, so that different event histories producing the same knowledge do not
    create a false divergence.
20. As a maintainer, I want node and edge schemas validated before output is
    replaced, so that Git never receives a partially written graph.
21. As a maintainer, I want referential integrity checked after compatible events
    are combined, so that every active edge names existing active nodes.
22. As a maintainer, I want deductive DAG validation applied to the combined
    graph, so that two individually valid branches cannot introduce a merged
    derivation cycle.
23. As a maintainer, I want cycle-forming branch events preserved in a merge
    contradiction but not activated, so that Ariadne keeps the knowledge without
    violating ADR 0009.
24. As a maintainer, I want an edge addition on one branch and removal on the
    other to be represented explicitly, so that event ordering cannot choose the
    relationship state.
25. As a maintainer, I want different locked decisions for the same declared
    decision scope detected even when their node IDs differ, so that the merged
    model cannot present two incompatible policies as one decision.
26. As a decision owner, I want branch merge to preserve the historical status
    of a locked decision without synthesizing authorization, so that merge
    machinery cannot silently reopen or replace a human decision.
27. As a decision owner, I want the merged-scope decision gate to remain
    unresolved while a decision-scope contradiction is open, so that branch-local
    authority is not mistaken for global convergence.
28. As an evidence reviewer, I want provenance values copied unchanged from their
    source variants, so that merging does not turn assumptions into facts or
    branch-local decisions into universal evidence.
29. As a repository owner, I want setup to be idempotent and non-destructive, so
    that enabling Ariadne does not replace existing Git attributes, hooks, or
    local configuration.
30. As a repository owner, I want setup to report an existing incompatible merge
    driver or hook configuration, so that integration choices remain explicit.
31. As a repository owner, I want every valid local `DIVERGED` result to permit
    merge and commit, so that reconciliation can happen after code integration.
32. As a repository owner, I want an explicit CI check for unresolved merge
    contradictions, so that publication policy remains separate from semantic
    merge behavior.
33. As a repository owner, I want the pre-commit path to cover a merge completed
    after manual Git conflict resolution, so that checks do not depend solely on
    `pre-merge-commit`.
34. As a repository owner, I want generated indexes and cards regenerated from
    the merged canonical graph, so that projections cannot preserve a stale
    branch-specific view.
35. As a GSD user, I want the same semantic merge behavior in the GSD epistemic
    overlay as in standalone mode, so that deployment mode does not change model
    integrity.
36. As a verifier, I want a temporary real Git repository test to exercise the
    registered merge driver, so that argument ordering, output replacement, and
    exit codes are proven at the actual integration boundary.
37. As a verifier, I want a failed merge to leave the current-side temporary file
    byte-for-byte unchanged, so that failure is atomic and recoverable.
38. As a verifier, I want a second run over the same inputs to produce identical
    bytes and receipts, so that the driver is deterministic and idempotent.
39. As a verifier, I want local non-blocking behavior and the explicit CI check
    tested separately from semantic merge behavior, so that publication policy
    cannot change the merged model.
40. As a verifier, I want unresolved merge contradictions visible in status,
    reports, and visualization through existing graph projections, so that no
    separate conflict dashboard is required.
41. As a repository user, I want a cloned repository to diagnose missing local
    merge integration before changing the graph, so that Git never silently
    falls back to an unsafe textual merge.
42. As an auditor, I want common-ancestor events retained exactly and merged
    semantic changes appended canonically, so that shared history remains
    inspectable without copying branch suffixes.
43. As a developer, I want delete/modify handled as a visible divergence, so
    that neither deletion nor modification receives hidden precedence.
44. As a developer, I want unsupported Git operations to fail with a clear
    diagnostic, so that untested rebase or cherry-pick behavior cannot corrupt
    the graph.
45. As an autonomous agent, I want a `DIVERGED` result to expose conflict-card
    links and reconciliation guidance without launching an agent from Git, so
    that reasoning resumes through the normal Ariadne frontier.
46. As a repository owner, I want merge semantics pinned independently from the
    package release, so that an unrelated CLI upgrade cannot silently change
    conflict identity or output.
47. As an evidence reviewer, I want a merge that changes project files to request
    explicit verification without mass-invalidating unrelated evidence.
48. As a developer, I want hooks to stage only fully derived files, so that
    host-owned metadata in state is never committed accidentally.
49. As an autonomous agent, I want reconciliation to choose a stored variant or
    submit a validated synthesized delta, so that simple and novel resolutions
    use one atomic boundary.
50. As a repository owner, I want oversized model input to fail without
    truncation, so that resource protection cannot violate lossless merge.

## Implementation Decisions

### Three-way merge boundary

- Implement one pure semantic merge operation that accepts parsed base, current,
  and incoming event logs and returns either a complete replacement log plus a
  receipt, or a failure without output. The CLI and Git integration are thin
  adapters around this operation.
- Treat the common ancestor as mandatory. Do not implement a two-way fallback,
  because it cannot distinguish an addition from an edit or removal safely.
- Materialize all three inputs through the existing Epistemic Graph Engine and
  validate each input before computing semantic deltas from their materialized
  nodes and edge states.
- Build the output from the common-ancestor log plus the canonical semantic
  changes needed to reach the merged model. Preserve the base log bytes and event
  order, then append the minimal deterministic set of final node revisions, edge
  additions or tombstones, and Merge Contradictions. Do not copy raw branch event
  suffixes into the output or conflict payload.
- Canonicalize independent semantic changes and conflict variant ordering so
  that swapping branch roles does not change the materialized result, serialized
  result, or conflict IDs.
- Use canonical JSON serialization for comparisons, event identity, content
  digests, deterministic ordering, and conflict identity. Do not compare raw
  whitespace.
- Define `merge_protocol_version: 1` independently of the package and general
  graph schema versions. Include it in the configured driver identity, every
  Merge Contradiction, and every Merge Receipt. Reject unsupported protocol
  versions before writing output.
- Apply deterministic protocol ceilings to input bytes, node count, edge count,
  and Causal Quarantine size. Repository configuration may lower but never raise
  the implementation's v1 hard ceilings. Exceeding any ceiling returns `FAILED`
  without truncating knowledge or changing the result file.

### Merge semantics

- Apply a materialized semantic change that exists on only one branch when it
  remains valid with the other branch model.
- Deduplicate canonically identical resulting node revisions and edge states,
  even when the branch event histories differ.
- Treat two different revisions of the same node ID relative to the base as a
  node revision conflict. Do not append both active revisions because the
  current materializer would make order select a winner.
- Treat two different newly created nodes with the same ID as an add/add node
  conflict.
- Treat an edge addition opposed by an edge tombstone relative to the base as an
  edge-state conflict. Preserve the base edge state until reconciliation when a
  base state exists; otherwise leave the edge inactive.
- Treat node removal values and edge tombstones with normal three-way semantics.
  A delete opposed only by an unchanged branch applies; identical deletes
  deduplicate; a delete opposed by a modification creates a Merge Contradiction
  and keeps the ancestor value active.
- Validate the union of otherwise compatible semantic changes. If the union
  creates a dangling reference, invalid endpoint relation, or deductive cycle,
  quarantine every newly introduced materialized change needed to remove the
  violation without preferring a branch and record one topology conflict per
  connected violation. Return `DIVERGED`, not `FAILED`, when every input model
  was valid independently.
- A conflict record uses a deterministic `CTR-merge-*` ID, `FACT` provenance for
  the directly observed divergence, status `MERGE_CONFLICT`, and
  `conflict_kind: branch_merge`. Derive the incident ID from the conflict kind,
  subject, base digest, and sorted variant digests so branch order cannot affect
  identity. Deduplicate an identical incident; when a variant changes, create a
  new incident and link it to the prior incident with `supersedes`.
- Store the subject key, base value, normalized materialized branch variants,
  source digests and labels, quarantined nodes or edge states, diagnostic codes,
  and conflict digest in the conflict payload. Embedded branch claims keep their
  original provenance as data; the conflict record does not upgrade them.
- Exempt a `branch_merge` contradiction from the Semantic Gate's Separation
  Diversity requirement. A merge-specific read-only check owns unresolved
  publication policy, while structural and epistemic validation still apply to
  the active graph.
- Keep the common-ancestor active value for a conflicting existing node. If the
  subject did not exist in the ancestor, represent both additions only inside the
  conflict record until reconciliation. Status, report, and visualization
  surfaces must show an active ancestor value as shadowed by its unresolved merge
  contradiction rather than globally current.
- Compute Causal Quarantine from the conflicting subject through the existing
  invalidation influence orientation: target-to-source for `depends_on` and
  `derived_from`, source-to-target for `supports` and `invalidates`, and
  dependency-to-owner for node `dependencies`. Continue transitively, but
  quarantine only values added or changed by a branch.
- Do not propagate Causal Quarantine through `references`, `contradicts`, `tests`,
  `falsifies`, or other non-causal relations. Preserve quarantined materialized
  values inside the same conflict payload and use Git history for raw event
  inspection.
- Reconciliation uses a dedicated compare-and-swap command with the conflict ID
  and expected conflict digest. In one Epistemic Graph Engine transaction it
  validates the selected or synthesized canonical changes, authorization,
  released quarantine, and prospective graph before appending the changes and
  marking the `CTR-merge-*` node resolved. An agent may perform this operation
  for non-decision nodes under normal evidence and gate rules. Replacing or
  changing a locked decision requires decision-owner authorization.
  Reconciliation never deletes the conflict history.
- Require exactly one reconciliation input mode: select the stored base or one
  stored variant by content digest, or supply a schema-validated
  `ariadne-delta` that synthesizes canonical changes. Reject branch-label-only
  selection and arbitrary replacement graph files.

### Decision and provenance semantics

- Add an optional stable `decision_scope` field to decision nodes. It identifies
  the policy or question a decision settles and is the only cross-ID semantic
  identity used by the first release.
- Match ordinary nodes only by node ID. Preserve different-ID nodes independently
  even when their prose appears related; a post-merge agent may register a normal
  semantic contradiction after inspecting them.
- When both branch deltas contain incompatible `DEC-*` nodes with the same
  `decision_scope`, preserve both as variants in a decision-scope merge
  contradiction. Do not select either decision and do not synthesize a decision
  status transition.
- Keep any decision already locked in the common ancestor historically locked.
  An open merge contradiction causes the merged-scope decision gate to report
  divergence; it does not silently rewrite the ancestor decision.
- Preserve every node's provenance exactly. Do not average, maximize, meet, or
  otherwise recompute provenance merely because two branches were merged.
- Record source content digests in merge contradictions and receipts. Existing
  evidence schemas do not provide general executable bindings from `FACT` or
  `MEASURED` claims to Git paths and content digests, so merge must not pretend to
  perform precise invalidation.
- When the staged merge changes any file outside the Ariadne graph and its fully
  derived projections, add `POST_MERGE_VERIFICATION_REQUIRED` to the Merge
  Receipt. Preserve provenance and graph status; targeted revision binding and
  invalidation remain a separate future capability.

### Git and CLI contract

- Register the canonical Epistemic Graph log with a repository-scoped custom
  Git merge driver. Git supplies the ancestor, current/result, and incoming
  temporary files; Ariadne writes only the current/result temporary file.
- Return zero for both `CLEAN` and `DIVERGED`, because both outcomes produce
  a lossless schema-valid graph. Return non-zero only for `FAILED` and leave the
  current/result file unchanged.
- Emit a compact summary to standard error for Git users and support a structured
  JSON receipt for direct CLI, hook, CI, and agent use. The receipt contains the
  outcome, input digests, applied and deduplicated subjects, created conflict IDs,
  quarantined subjects, validation diagnostics, output digest, protocol version,
  and deterministic-detection coverage.
- Persist unresolved `DIVERGED` knowledge only through its Merge Contradictions.
  Return `CLEAN` and `FAILED` Merge Receipts to the caller without appending graph
  nodes or creating a separate merge ledger; CI may archive those receipts.
- Keep semantic merge deterministic and model-independent. Do not invoke an LLM
  or an autonomous agent from the merge driver or commit hook.
- Provide an idempotent setup operation that adds only missing Ariadne Git
  configuration. If an existing attribute, driver, hook path, or hook file would
  be overwritten, stop and report exact manual integration instructions.
- Keep the driver command and hooks in repository-local Git configuration. Add a
  read-only doctor operation that verifies committed attributes, local driver and
  hook configuration, executable availability, and compatible versions. Missing
  or incompatible integration fails closed; the merge path never downloads code
  or changes global Git configuration.
- Register fully derived indexes and cards with a generated-file merge driver
  that temporarily retains the current copy instead of creating textual merge
  conflicts. The canonical graph preserves the incoming knowledge.
- Use `pre-merge-commit` only for post-merge validation, projection regeneration,
  and a non-blocking summary. Also use `pre-commit` when Git is completing a
  manually resolved merge. Do not use `post-merge` as an enforcement point
  because it cannot change the merge outcome.
- Have both non-blocking hooks run one idempotent projection synchronization
  command. The same command is the documented repair path when hooks are absent
  or bypassed.
- Permit hooks to stage only fully derived indexes and cards. Synchronize
  Ariadne-owned frontier fields in state in the working tree, leave the state
  file unstaged, and report its path whenever synchronization changed it. Never
  stage passthrough host metadata implicitly.
- Always permit local commit of a valid `DIVERGED` result. Provide a separate
  read-only check command that returns non-zero when unresolved merge
  contradictions exist, for repositories that opt into CI or protected-branch
  enforcement.
- Guarantee and test the first protocol only for ordinary `git merge`. Detect and
  fail closed for rebase, cherry-pick, revert, or unsupported recursive
  merge-base invocation until each operation has dedicated acceptance fixtures.
- Never launch an agent or enqueue work from the driver or hooks. A `DIVERGED`
  summary prints actual conflict-card links and reconciliation guidance; the
  `MERGE_CONFLICT` nodes remain on the normal graph frontier for the next Ariadne
  invocation.

### Artifact ownership

- Define the Branch Epistemic Model as the materialized Epistemic Graph at a Git
  revision and treat its event log as the only canonical semantic merge source.
  Regenerate the graph index and card files from the successfully merged graph
  instead of semantically merging their rendered text.
- Preserve non-derived host metadata in state through its existing ownership
  rules, then recompute only Ariadne-owned frontier and open-unknown projections.
  State and operational notices are outside the Branch Epistemic Model and may
  still follow normal Git conflict behavior.
- Do not make generated reports a merge input. They may remain historical
  snapshots, but a fresh report or visualization must read the merged graph.
- Apply the same behavior to standalone and GSD storage roots selected by the
  existing workspace resolver. Do not add another graph store or mode-specific
  merger.

## Testing Decisions

The primary test seam is the public three-way merge boundary exercised through
the CLI in a temporary Git repository. This is the highest practical seam
because it verifies Git's ancestor/current/incoming argument contract, atomic
replacement of the result file, driver exit codes, the public receipt, and the
materialized graph in one observable flow. Pure engine tests may cover dense
graph fixtures, but tests must not couple to private comparison or ordering
helpers.

The following behaviors require executable coverage:

1. Two branches add different nodes and edges; the result is `CLEAN` and
   contains both valid deltas.
2. Both branches add the same canonical event with different formatting; the
   result deduplicates it.
3. One branch changes a node and the other leaves it equal to the ancestor; the
   changed revision is active.
4. Both branches change the same node to the same canonical revision; one active
   revision remains.
5. Both branches change the same node differently; the ancestor revision remains
   active, both variants survive in one unresolved `CTR-merge-*`, and Git receives
   exit code zero.
6. Both branches add different nodes with the same new ID; neither new node
   becomes active and both complete variants survive in the conflict record.
7. One branch removes an ancestor edge while the other modifies the same edge
   state; the base state and both variants are represented without ordering
   precedence.
8. Two individually valid edge additions create a deductive cycle only when
   combined; the active output remains a DAG, all cycle-forming materialized
   changes remain in a topology conflict, and the driver returns `DIVERGED`.
9. A quarantined node variant has dependent branch-local edges; the output has no
   dangling references, every changed value in its transitive causal closure is
   recoverable, and unrelated reference-only nodes remain active.
10. Two different decision IDs declare the same `decision_scope` with
    incompatible locked decisions; the merged-scope gate reports divergence and
    neither branch decision is selected as globally authoritative.
11. Different non-decision IDs with contradictory prose are preserved
    independently and do not invoke semantic matching inside the deterministic
    driver.
12. Provenance values in active and quarantined nodes are byte-equivalent after
    normalization to their source values.
13. Swapping current and incoming inputs produces the same serialized graph,
    conflict IDs, and normalized receipt apart from explicitly labeled source
    presentation.
14. Repeating the same merge produces the same bytes, output digest, and conflict
    IDs.
15. Malformed JSONL, schema-invalid events, or any invalid input graph returns
    `FAILED`, returns non-zero, and leaves the result file unchanged.
16. The repository setup operation can run twice without duplicate attributes or
    configuration and refuses to overwrite an incompatible existing setup.
17. A valid local `DIVERGED` result permits the commit, while the separate
    read-only CI check returns non-zero without changing the graph.
18. Agent reconciliation succeeds for a non-decision conflict with valid
    evidence, while a locked-decision reconciliation fails without decision-owner
    authorization and leaves the graph unchanged.
19. The pre-commit validation path covers a repository whose ordinary Git
    conflicts were resolved manually before committing the merge.
20. Index, cards, frontier, and open-unknown state are regenerated from the merged
    graph while unrelated host-owned state fields survive.
21. Status, report, and visualization surfaces show both the unresolved
    `CTR-merge-*` and any shadowed ancestor value.
22. Standalone and GSD workspaces produce equivalent semantic outcomes for the
    same input graphs.
23. A `branch_merge` contradiction remains visible with status `MERGE_CONFLICT`,
    does not trigger Separation Diversity, and causes only the explicit merge
    check to fail.
24. Identical conflict inputs generate one incident ID regardless of branch
    order; a changed variant generates a new incident linked to the former one
    with `supersedes`.
25. Reconciliation with a stale expected conflict digest fails atomically and
    leaves the graph and generated projections unchanged.
26. Generated index or card changes never create a textual Git conflict; the
    non-blocking hook rebuilds them, and the explicit synchronization command
    repairs them when the hook is absent.
27. A `CLEAN` receipt states its explicit detection coverage and never claims
    that different-ID natural-language claims were proven equivalent.
28. The merged event log retains the base bytes and order, appends only the
    canonical semantic delta, and materializes to the expected merged graph.
29. Delete/unchanged and delete/delete apply one tombstone, while delete/modify
    produces `DIVERGED` with the ancestor active and both variants preserved.
30. A fresh clone without compatible local driver configuration fails the doctor
    check without modifying files; installation is idempotent and never invokes
    the network or global Git configuration.
31. Ordinary `git merge` exercises the semantic driver, while detected rebase,
    cherry-pick, revert, and unsupported recursive invocations fail closed with
    an actionable diagnostic.
32. `CLEAN` and `FAILED` return complete Merge Receipts without appending graph
    events; `DIVERGED` persists only its unresolved Merge Contradictions.
33. A `DIVERGED` summary contains resolvable card links and guidance but creates
    no process, queue item, Operational Notice, or other agent handoff state.
34. A driver configured for protocol v1 rejects an incompatible CLI or payload
    protocol before changing output, while package-only version changes do not
    change protocol identity.
35. A merge that changes a non-Ariadne file emits
    `POST_MERGE_VERIFICATION_REQUIRED` without changing provenance or node
    statuses; a graph-only merge does not emit the signal.
36. Projection synchronization stages index and cards only, updates state in the
    working tree without staging it, and preserves unrelated host metadata.
37. Reconciliation can select base or a stored variant by digest and can apply a
    synthesized `ariadne-delta`; providing both modes, neither mode, a stale
    digest, or an arbitrary graph file fails atomically.
38. Inputs at every protocol ceiling merge normally; inputs exceeding one ceiling
    return `FAILED`, retain the result bytes, and never emit a truncated conflict.

Reuse the existing Epistemic Delta merge tests as prior art for canonical
deduplication, conflicting IDs, atomic failure, and graph validation. Reuse the
existing worktree tests for temporary Git repository setup and process-safe Git
invocation. Reuse current CLI command tests for captured output and exit codes,
and current graph storage tests for transaction atomicity and derived projection
synchronization.

## Out of Scope

- Detecting arbitrary natural-language contradictions between different node IDs.
  The first release uses shared node identity, graph topology, and
  `decision_scope` only.
- Treating a `CLEAN` result as proof of arbitrary semantic agreement.
- Asking an LLM or agent to resolve contradictions during Git's merge process.
- Blocking every merge that contains an unresolved epistemic contradiction.
  Warning mode remains the default.
- Making local Git hooks unbypassable. Mandatory policy belongs in CI or branch
  protection.
- Replacing Git's merge machinery for source code, delivery artifacts, or other
  non-Ariadne files.
- Semantically merging generated indexes, cards, reports, or visualizations as
  independent sources of truth.
- Automatically changing, reopening, or authorizing a locked human decision.
- Recomputing evidence provenance or automatically re-running evidence after a
  merge.
- Implementing general path-and-content revision binding for existing evidence;
  protocol v1 emits a Post-Merge Verification Requirement instead.
- General CRDT replication, remote graph synchronization, or a hosted merge
  service.
- Copying complete branch event suffixes into merge contradictions or another
  conflict ledger; Git parent history remains the event-history source.
- Automatically committing, pushing, or opening a pull request after setup or
  merge.
- Guaranteeing rebase, cherry-pick, revert, or complex recursive merge-base
  behavior in the first protocol version.
- Launching, scheduling, or enqueueing an autonomous agent from Git integration.
- Adding a new hook-management dependency when native Git configuration and the
  existing CLI are sufficient.

## Further Notes

This specification extends ADR 0009's schema-validated Epistemic Delta and
strict deductive DAG decisions from one-way subagent contributions to a
three-way Git integration. It does not change the ADR's rule that genuine
circular tensions are modeled as `CTR-*` rather than accepted as deductive
cycles.

The core separation is intentional: the Git merge driver preserves information
and produces a valid graph, while hooks and CI apply repository policy. An
epistemic disagreement is data for Ariadne, not automatically a Git transport
failure.

Git documents `pre-merge-commit` as a hook that runs after a successful automatic
merge and before the merge commit, and notes that normal conflicts prevent it
from running. Git's custom merge-driver contract provides the common ancestor,
current/result, and incoming files and requires the driver to overwrite the
current/result file. See the official
[githooks documentation](https://git-scm.com/docs/githooks#_pre_merge_commit)
and
[custom merge driver documentation](https://git-scm.com/docs/gitattributes#_defining_a_custom_merge_driver).

Git does not distribute local hook installation through clone. The repository
must therefore carry declarative setup instructions, and each developer or CI
environment must run the idempotent setup operation before relying on automatic
integration.
