# Operation 50: Knowledge

## Trigger and purpose

Use Knowledge when an `UNK-*` or `ASM-*` fact can change a Candidate Mechanism,
invalidate a path, or alter a hard requirement. A Decision-Significant Unknown
is not a general research task. It is a missing fact with a decision branch.

## Unknown procedure

1. Register the unknown with a measurable question, current provenance, owner,
   affected candidates, and decision deadline.
2. State at least two possible outcomes and the candidate or invariant that
   each outcome supports or falsifies.
3. List available sources in this order: repository facts and runtime data,
   primary-source research, a disposable prototype or spike, a benchmark,
   profile, or controlled production telemetry.
4. Choose the lowest-cost safe test that discriminates between the outcomes.
   Prefer a read-only inspection over a new experiment when it has equal
   discriminating power. Use Matt `research` for a primary-source question and
   Matt `prototype` for one disposable executable design question.
5. Set a stopping rule, required Evidentiary Ladder rung, and cleanup rule.
6. Emit an `EVDREQ-*`; do not mark the unknown resolved until an `EVD-*` result
   records the method, verdict, and reproducible receipt.
7. Update the assumption registry and rerun affected quality gates. A result
   MAY support one candidate and falsify another.

## Discriminating test choice

Compare tests by:

`decision impact × candidate discrimination ÷ cost and operational risk`.

This is a selection aid, not a compensatory Value score. A cheap test with no
different predictions is not discriminating. A cheap test that can corrupt
state is not safe. A high-cost test is justified only when a decision cannot
be made from repository facts or a smaller spike.

## EVDREQ card

An `EVDREQ-*` MUST state:

- the target `UNK-*` or `ASM-*` and affected `CAN-*` records;
- the claim class and minimum Evidence Ladder rung;
- the question, competing outcomes, and falsification predicate;
- method, command or source, inputs, environment, and stopping rule;
- safety, cleanup, owner, and deadline.

The resulting `EVD-*` MUST state `SUPPORTED`, `FALSIFIED`, or `INCONCLUSIVE`,
the observed value, receipt, and provenance. An inconclusive result keeps the
unknown open.

## Examples

Positive: “Can the current database sustain p99 latency below 20 ms at 5000
requests per second?” The repository is inspected first. If no fact answers it,
run a disposable benchmark with a fixed workload and a p99 stopping rule.
The request uses Rung 7 because it concerns Throughput & Latency.

Negative: “Research caching options.” It has no decision branch, claim class,
candidate impact, or falsification condition. It is not an `UNK-*` request.

## Handoff and gate

Knowledge MUST hand off `EVDREQ-*` to a provider and `EVD-*` to the Evidence
and Invalidation rules. The Epistemic Gate MUST keep an unknown unresolved when
the evidence is below the requested rung or cannot discriminate the outcomes.
