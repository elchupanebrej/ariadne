# Operation 40: Explore

## Trigger and purpose

Use Explore when a proposal set is narrow, vendor-biased, or made only of
configuration variants. Explore categorizes Candidate Mechanisms by operating
principle, state ownership, and boundary. It MUST create architectural
diversity before a decision is locked.

## Candidate procedure

1. Copy the required behavior and invariants from `FRAME-*`.
2. List orthogonal dimensions: state owner, consistency, execution mode,
   communication, storage, failure boundary, and deployment boundary.
3. Generate candidates across the four Separation Principles: Time,
   State/Data, Operating Condition, and System Boundary.
4. Build a morphological field and combine compatible values. Name the
   mechanism class, not only the product or vendor.
5. Prune combinations that violate hard invariants. Keep a record of the
   reason for each pruning decision.
6. Test the change radius, new mutable state, and evidence cost of each
   candidate. Hand candidates to Dependencies, Dynamics, and Value.

In Standard and Deep modes, an active `CTR-*` MUST have at least three
structurally distinct candidates. The candidates MUST span different
Separation Principles. The first three candidate records are conventionally
`CAN-01`, `CAN-02`, and `CAN-03`. Three tuning values of one mechanism are one
class and do not satisfy this rule.

## 9-box Multi-Screen Scheme

The System Operator is a 9-box view. Rows are structural levels: `Subsystem`,
`System`, and `Supersystem`. Columns are temporal horizons: `Past`, `Present`,
and `Future`. For each box, record the function, owner, invariant, and failure
mode. Use the view to find a boundary shift or a transition mechanism that a
present-only design hides.

## SPACE card and Candidate Mechanism

A `SPACE-*` card MUST contain the behavior, hard invariants, dimensions,
9-box observations, candidate classes, pruned combinations, and active
contradictions. Each `CAN-*` MUST contain:

- mechanism class and operating principle;
- state/data owner and system boundary;
- supported invariants and known violated constraints;
- useful effect, harm, change radius, and failure modes;
- required Evidence Requests and falsification predicates;
- provenance and links to `FRAME-*`, `CTR-*`, `DEP-*`, or `DYN-*`.

## Separation matrix

| Principle | Candidate question |
| --- | --- |
| Time | Can the conflicting properties hold in different phases or windows? |
| State/Data | Can ownership or representation separate the conflicting state? |
| Operating Condition | Can normal, burst, degraded, or recovery modes use different mechanisms? |
| System Boundary | Can the function move to another module, service, tier, client, edge, or runtime? |

## Examples

Positive: three candidates for retaining events during worker restart use
state-owned durable outbox (State/Data), a recovery-only replay log (Time),
and a boundary-owned queue service (System Boundary). Each has a distinct
failure predicate.

Negative: Redis cluster, Redis persistence setting, and Redis shard count are
one mechanism class. They do not satisfy Separation Diversity.

## Handoff and gate

Explore MUST hand off a `SPACE-*` map and `CAN-*` records. The Semantic Gate
MUST reject a Standard or Deep decision with fewer than three distinct active
candidate classes for an active contradiction.
