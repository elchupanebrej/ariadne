# Three-Way Branch Epistemic Merge

Ariadne will merge Branch Epistemic Models through a deterministic custom Git
merge driver that materializes the common ancestor and both branches. Compatible
semantic changes compose normally. Incompatible changes become graph-native
Merge Contradictions, and only their branch-local Causal Quarantine is withheld
from the active graph. A valid divergence succeeds locally; malformed input is a
Git conflict, while convergence policy belongs to an explicit CI check.

The driver reports `CLEAN`, `DIVERGED`, or `FAILED`. `CLEAN` means that explicit
identity and topology rules found no conflict; it is not proof of arbitrary
semantic convergence. A Merge Contradiction has status `MERGE_CONFLICT`, is
exempt from inventive-candidate breadth, and is resolved through one
compare-and-swap Graph Engine transaction.

Merge semantics and payloads use an independent Merge Protocol Version. Protocol
v1 fails before writing when the installed driver is incompatible or when input
bytes, nodes, edges, or Causal Quarantine exceed deterministic hard ceilings;
repository configuration may only lower those ceilings.

The Merge Contradiction stores materialized branch variants and normalized input
digests, not copied event suffixes, because Git parent revisions already own raw
history. An existing subject keeps its common-ancestor value active and visibly
shadowed; an add/add subject stays absent. Deterministic matching uses node ID and
Decision Scope only. Agents may reconcile non-decision conflicts under normal
evidence rules, but locked decisions retain decision-owner authority.
Conflict incidents are content-addressed from their subject, base, and sorted
variant digests; changed incidents supersede rather than overwrite earlier ones.
The output retains the exact common-ancestor event log and appends a minimal
canonical semantic delta. Tombstones follow normal three-way rules, so a
delete/modify pair diverges instead of giving either operation precedence.

## Considered Options

- Copying complete branch event suffixes was rejected because it duplicates Git
  history and enlarges every conflict payload.
- A sidecar conflict ledger was rejected because it creates a second epistemic
  state surface outside normal graph traversal.
- Universal semantic keys and LLM matching inside the merge driver were rejected
  because they require a broad migration or make Git merge nondeterministic.

## Consequences

The active graph remains schema-valid and acyclic, branch direction never chooses
a winner, and developers may integrate code before epistemic reconciliation.
Different-ID semantic contradictions can remain undetected until an agent
examines the merged model, and derived or operational artifacts remain outside
the semantic merge boundary. Generated indexes and cards temporarily retain the
current copy during Git merge and are rebuilt by non-blocking hooks or an
explicit synchronization command.

The first protocol guarantees ordinary `git merge` only. Repository-local
installation and a doctor check fail closed when the driver, hooks, executable,
or versions are missing or incompatible; the merge path never downloads code.
Only unresolved divergence persists in the graph. Clean and failed attempts
return non-normative Merge Receipts, and Git integration never starts or queues
an agent.

Because current evidence has no general executable binding to Git paths and
content digests, merge preserves provenance and emits a Post-Merge Verification
Requirement when non-graph files changed. Hooks stage only fully derived indexes
and cards; they update state in the working tree without staging host metadata.
Reconciliation selects a stored value by digest or supplies one validated
`ariadne-delta`, never an arbitrary replacement graph.
