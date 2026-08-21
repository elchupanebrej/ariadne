# Operation 05: Uncertainty Ingress

## Trigger and purpose

Run this preflight when the task contains a decision-significant ambiguity or
unknown: competing interpretations, an unverified assumption, contradictory
signals, competing hypotheses or candidates, an unsafe transition, or a fact
whose outcome changes the next action. Do not run it for a routine request with
a known answer and no meaningful branch.

The purpose is to prepare the epistemic substrate before grilling, specifying,
ticketing, or implementing. Ariadne owns the uncertainty graph; downstream
skills own their own workflow.

## Preflight

1. Frame the uncertainty in one sentence without naming a mechanism as fact.
2. Create or link the smallest useful cards: `FRAME`, `UNK`, `ASM`, `CTR`,
   `HYP`, `CAN`, `EVDREQ`, and `OBS` as applicable.
3. Record repository facts, invariants, constraints, and tool failures as
   persisted cards. Tool failures use `OBS-*` with the command, error,
   workaround, impact, and component.
4. Route to the targeted operation rule. Use `50-knowledge.md` for a missing
   discriminating fact, `40-explore.md` for structurally distinct candidates,
   `80-value.md` for a choice, and `90-validate.md` for a claim or transition.
5. Leave unresolved questions on the frontier. Do not manufacture a decision
   to make a handoff possible.

## Downstream substrate

Before handing control to a downstream skill, provide:

- active facts, invariants, constraints, and assumptions;
- contradictions, hypotheses, candidates, and evidence with provenance;
- unresolved frontier and explicit resolution order when history is available;
- a recommended answer for every question, derived from the current selection
  or decision cards and marked as provisional when uncertainty remains;
- inline Markdown links whose href targets an existing persisted artifact file.

When cards share `GRAPH.jsonl`, link each card label to that real graph file
and link `INDEX.md` and `STATE.yaml` separately. Never invent a per-card path
or expose a bare card ID as if it were a document.

## Handoff boundary

An explicit grill request still runs this preflight first, then hands the
substrate to `grilling`/`grill-with-docs`. A normal uncertainty signal also
runs the preflight, but does not automatically start grilling, `/to-spec`,
`/to-tickets`, or implementation. Those remain human-controlled handoffs.
