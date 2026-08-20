# Operation 80: Value

## Trigger and purpose

Use Value when several Candidate Mechanisms satisfy the required behavior. Value
selects a candidate without allowing preference scores to compensate for a
failed hard requirement. It MUST preserve uncertainty and run an Adversarial
Critique before a decision lock.

## Selection procedure

This is a non-compensatory selection: a failed hard requirement removes a
candidate before preference comparison.

1. Copy hard invariants, safety constraints, and claim classes from the
   `FRAME-*`, `HYP-*`, `DEP-*`, and `DYN-*` records.
2. Filter candidates. A candidate that fails a hard requirement is ineligible;
   its preference score MUST NOT restore it.
3. For surviving candidates, record useful effect, mechanism cost, code and
   mutable-state cost, infrastructure cost, operational harm, cognitive load,
   and change radius.
4. Record assumptions, unknowns, evidence rung, and unresolved risks. Value
   MAY compare uncertainty; it MUST NOT relabel uncertainty as fact.
5. Run the Adversarial Critique against complexity shifts, hidden mutable
   state, ownership gaps, degraded modes, and transition risk.
6. Select or defer. A `DEC-*` lock MUST cite the passing hard requirements,
   evidence, critique result, and owner. It MUST remain open when a dependency
   is `ASSUMED`, `UNKNOWN`, `FALSIFIED`, or `NEEDS_REVIEW`.

## VAL-SELECT card

A `VAL-SELECT-*` card MUST contain:

- hard requirements and the pass/fail result for every candidate;
- preference criteria and their independent observations;
- useful effects, harms, costs, change radius, and operating conditions;
- provenance, evidence rung, assumptions, and unknowns;
- Adversarial Critique attacks and responses;
- selection, deferral, or rejection reason and next Evidence Requests.

The card MUST use a constraint filter before any ranking. A weighted average
MUST NOT trade a failed hard requirement for a useful effect. A score MAY rank
eligible candidates only after the filter, and the score is not provenance.

## Example and gate

Positive: Candidate A meets the durability invariant with higher cost; Candidate
B is cheaper but loses data during restart. B is rejected before preferences
are compared.

Negative: “B scores 95 because it is cheap, so its failed durability check is
acceptable.” This is compensatory scoring and is invalid.

The Epistemic Gate MUST reject a `DEC-*` without a passing hard-requirement
filter, matching evidence, and an Adversarial Critique.
