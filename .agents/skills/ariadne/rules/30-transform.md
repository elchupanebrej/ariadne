# Operation 30: Transform

## Trigger and purpose

Use Transform when a causal mechanism is known or a current design creates
avoidable complexity, mutable state, coupling, or harm. Transform MUST search
for a structural change before tuning a parameter. It MUST preserve the
behavioral requirements and invariants from `FRAME-*` and verified findings
from `HYP-*`.

## Transformation procedure

1. Record the current component, state, boundary, and useful function.
2. Apply the smallest relevant transformation: trim, split, combine or
   delegate, replace the mechanism, or change quantity/order/time/placement.
3. Apply Separation Principles where one component must satisfy conflicting
   requirements: Time, State/Data, Operating Condition, or System Boundary.
4. State the function receiver when a component is removed or delegated.
5. Record new state, coupling, failure modes, and migration needs. A reduction
   in local code MUST NOT hide a larger operational or cognitive cost.
6. Return a `TRF-*` card and candidate references for Explore and Value.

## Trimming procedure

Trimming removes a component while preserving its useful function. A trim is
valid only when all steps are recorded:

1. Name the component and the function it supplies.
2. Name the existing receiver that will supply that function.
3. Show the new call, data, or ownership path.
4. Check invariants, observability, rollback, and failure isolation.
5. Measure the useful effect and the new harm or coupling.
6. Add a decommissioning predicate when the component is temporary.

Trimming MUST NOT mean deleting code because it appears unused. A component is
trimmed only after its function has a verified receiver.

## Separation Principles

- **Separation in Time:** use different behavior during ingest, steady state,
  repair, migration, or rollback phases.
- **Separation in State/Data:** split ownership, representation, priority, or
  consistency requirements across data or state partitions.
- **Separation in Operating Condition:** use different mechanisms for normal,
  degraded, burst, offline, or recovery conditions.
- **Separation across System Boundary:** move a function to a client, module,
  service, data tier, edge, runtime, or build pipeline.

## TRF card

A `TRF-*` card MUST contain the source mechanism, useful function, selected
technique IDs, receiver or new boundary, preserved invariants, new costs,
failure modes, transition plan, and falsification conditions. It MUST label
each statement with provenance. A Transform result is a proposal until
evidence promotes it.

## Canonical 36-technique index

This index is the single source of truth for the 36 software techniques. A
rule MAY reference a technique by ID without copying its definition.

### Operation 1: Frame and Model

1. **Technique 1.1 — Separate Function from Implementation:** express a
   function without a code, service, library, or vendor noun.
2. **Technique 1.2 — Describe Required and Actual Behavior:** write observable
   conditions, invariants, and the behavioral delta.
3. **Technique 1.3 — Shift the System Boundary:** inspect function, module,
   service, system, and operational pipeline placement.
4. **Technique 1.4 — Shift Perspective:** inspect user, data owner, operator,
   adversary, adjacent service, and future developer effects.

### Operation 2: Find Constraint, Cause, or Contradiction

5. **Technique 2.1 — Identify Requirement Contradictions:** write the quality
   or operating-condition clash and its Separation Principle.
6. **Technique 2.2 — Identify the Limiting Bottleneck:** locate the constraint
   that limits throughput, latency, or delivery speed.
7. **Technique 2.3 — Construct a Causal Chain / Directed Acyclic Graph:** link
   observations to testable mechanisms and downstream effects.
8. **Technique 2.4 — Uncover Hidden Assumptions:** expose premises that make
   the current architecture appear inevitable.

### Operation 3: Transform the Mechanism

9. **Technique 3.1 — Remove or Reduce:** trim code, state, layers,
   intermediaries, checks, or coordination with a verified receiver.
10. **Technique 3.2 — Split or Localize:** separate data, ownership, time,
    mode, criticality, or execution environment.
11. **Technique 3.3 — Combine, Co-locate, or Delegate:** use an existing system
    mechanism to perform a function.
12. **Technique 3.4 — Replace the Mechanism:** substitute storage,
    communication, coordination, compute, or representation.
13. **Technique 3.5 — Change Quantity, Order, Time, or Placement:** change
    batching, ordering, frequency, execution timing, or compute location.

### Operation 4: Explore the Solution Space

14. **Technique 4.1 — Generate Fundamentally Distinct Directions:** vary the
    operating principle, state owner, or boundary, not only configuration.
15. **Technique 4.2 — Isolate Solution Space Dimensions:** build orthogonal
    architectural axes for a morphological field.
16. **Technique 4.3 — Combine Branches into Candidates:** combine compatible
    axis values to expose unexplored solution regions.
17. **Technique 4.4 — Prune Incompatible Combinations:** remove candidates that
    violate hard invariants or constraints.

### Operation 5: Generate Knowledge

18. **Technique 5.1 — Formulate Decision-Significant Unknowns:** state the
    missing fact whose result can change a candidate or decision.
19. **Technique 5.2 — Extract Knowledge from Existing Sources:** inspect
    repository, runtime, and primary-source evidence before new work.
20. **Technique 5.3 — Transfer Mechanisms from Other Domains:** map a known
    mechanism by invariant and boundary, not by superficial vocabulary.
21. **Technique 5.4 — Generate Knowledge via Experimentation:** use a spike,
    benchmark, prototype, profile, or telemetry query with a stopping rule.

### Operation 6: Analyze Dependencies

22. **Technique 6.1 — Map Static, Dynamic, Data, and Operational Dependencies:**
    record imports, runtime calls, ownership, deployment, and failure links.
23. **Technique 6.2 — Link Requirements to Enforcement Mechanisms:** show the
    exact mechanism that enforces each critical invariant.
24. **Technique 6.3 — Eliminate Accidental Co-Change Coupling:** retain only
    relationships required by behavior or ownership.

### Operation 7: Model Dynamics

25. **Technique 7.1 — Model Queues, Accumulations, Inflow/Outflow, and Capacity:**
    quantify arrival, service, stock, flow, and utilization.
26. **Technique 7.2 — Model Feedback Loops:** inspect retries, throttling,
    cascading failure, self-reinforcement, and recovery.
27. **Technique 7.3 — Account for Propagation Latency, Ordering, Versions, and
    Transitions:** model delay and skew across boundaries.
28. **Technique 7.4 — Account for Scale Growth and Behavior Adaptation:** find
    bottleneck migration as workload or client behavior changes.

### Operation 8: Evaluate Value

29. **Technique 8.1 — Separate Hard Constraints from Preferences:** filter
    failed invariants before comparing preferences.
30. **Technique 8.2 — Compare Useful Effect Against Mechanism Cost:** include
    code, state, infrastructure, and cognitive cost.
31. **Technique 8.3 — Account for Losses, Harm, and Change Radius:** include
    operational harm, blast radius, and failure recovery cost.
32. **Technique 8.4 — Decide Under Explicit Uncertainty:** preserve unknowns,
    assumptions, and evidence gaps in the selection record.

### Operation 9: Validate and Transition

33. **Technique 9.1 — Predict Useful and Undesirable Consequences:** state new
    failure modes and shifted complexity before implementation.
34. **Technique 9.2 — Turn Assertions into Executable Verifications:** choose
    the Evidentiary Ladder rung that matches the claim class.
35. **Technique 9.3 — Plan Transition as a Distinct System:** design version
    compatibility, dual-running, cutover, rollback, and decommissioning.
36. **Technique 9.4 — Anchor Results with Continuous Observation:** retain
    telemetry, rollback triggers, and cleanup receipts after cutover.

## Handoff and gate

Transform MUST hand off `TRF-*` cards and candidate mechanisms to Explore and
Dependencies. The Semantic Gate MUST reject a trim without a receiver, a
transformation that violates an invariant, or a candidate that hides a new
mutable state without a falsification condition.
