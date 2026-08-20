# Operation 20: Diagnose

## Trigger and purpose

Use Diagnose when the system has an undesirable state, regression, bottleneck,
or metastable failure and the causal mechanism is not proven. Diagnose MUST
separate a symptom from a Causal Hypothesis. It MUST not apply a fix before a
falsifying check exists.

## Diagnostic procedure

1. Record observations (`OBS-*`) with source, time, workload, environment, and
   reproducible commands. Label unknown values as `UNKNOWN`.
2. Define the invariant or behavioral requirement that the observation
   violates. State the observed delta without assigning a cause.
3. Build a causal DAG from trigger to mechanism to observed effect. Mark
   bottlenecks, feedback loops, hidden state, and boundary crossings.
4. Generate a differential diagnosis: at least two materially different
   hypotheses for a high-cost or high-change-radius defect. Do not rename one
   mechanism as several hypotheses.
5. For each hypothesis, state a prediction that differs from its alternatives
   and a falsification predicate that can fail.
6. Select the lowest-cost Evidence Request that discriminates the hypotheses.
   Use Matt `diagnosing-bugs` when a runnable red-capable feedback loop exists;
   record its result as `EVD-*` rather than copying its workflow.
7. Update provenance and contradictions only after the evidence result is
   recorded. A surviving hypothesis remains `PROPOSED` or `ASSUMED`, not `FACT`.

## HYP card

A `HYP-*` card MUST contain:

| Field | Requirement |
| --- | --- |
| `id`, `title` | Canonical ID and causal statement |
| `observations` | Linked `OBS-*` records and source receipts |
| `invariant_violation` | The required property that fails |
| `mechanism` | Testable computational cause, not a fix |
| `causal_dag` | Ordered antecedents and downstream effects |
| `variables` | Parameters, boundaries, and operating conditions |
| `prediction` | Observable result if the hypothesis is true |
| `falsification_predicate` | Result that rejects the hypothesis |
| `alternatives` | Differential `HYP-*` references |
| `evidence_requests` | Linked `EVDREQ-*` discriminating checks |
| `provenance` | Provenance for the hypothesis and premises |

The falsification predicate MUST be executable or directly measurable. “This
probably fixes the issue” is not a predicate.

## Diagnostic lenses

- Use Amdahl or critical-path analysis to locate a limiting bottleneck.
- Use queue depth, arrival rate, service rate, and retry counts to expose
  accumulation and feedback.
- Use a causal DAG to distinguish correlation from an antecedent dependency.
- Form a `CTR-*` node when improving one parameter causes another invariant to
  fail. Resolve it with Separation Principles, not a weighted compromise.
- Record hidden assumptions as `ASM-*` and link them to the hypothesis.

## Examples

Positive:

> Observation: p99 latency rises only when queue depth exceeds 90% capacity.
> Hypothesis HYP-01: retries amplify queue arrival rate after timeout. If true,
> disabling client retries in a controlled run MUST remove the growth while
> service rate and payload remain fixed. If queue growth remains, HYP-01 is
> falsified and HYP-02 (service-rate saturation) is tested.

Negative:

> “The database is slow; add a cache.”

This is a mechanism proposal without observations, a causal chain, a competing
hypothesis, or a falsification predicate.

## Handoff and gate

Diagnose MUST hand off surviving hypotheses and Evidence Requests to Transform,
Explore, Knowledge, or Validate. The Semantic Gate MUST reject a `HYP-*` card
without an explicit falsification predicate. A verified causal hypothesis MAY
raise provenance only to the rung supported by its evidence.
