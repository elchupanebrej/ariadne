# Specification: Ariadne Uncertainty Ingress and Epistemic Handoff

**Status:** ready-for-agent
**Triage:** ready-for-agent
**Decision basis:** `DEC-uncertainty-interaction-contract`

## Problem Statement

Tasks with ambiguous requirements, unknown facts, assumptions, competing
hypotheses, contradictions, or risky transitions can reach grilling,
specification, ticketing, or implementation without first creating an Ariadne
epistemic substrate. The current root signal names specialized reasoning
topics, but it does not reliably identify general decision-significant
uncertainty.

This loses the information Ariadne uniquely owns: claims, provenance,
unknowns, assumptions, contradictions, evidence requests, candidate mechanisms,
and the current decision frontier. It also makes the user answer questions
without seeing the artifacts and recommendations that justify them.

The workflow has additionally exposed tooling problems: graph edge contracts
reject valid `TRF-*` and `VAL-SELECT-*` sources for some relations, graph
mutations do not synchronize `STATE.yaml`, the pre-decision handoff generator
requires a locked decision, and semantic-gate diagnostics appear only after
partial graph construction.

## Solution

Add an Ariadne-owned uncertainty ingress with two stages:

1. A concise model-invoked trigger recognizes canonical
   decision-significant uncertainty signals.
2. A targeted uncertainty preflight confirms decision significance, creates or
   links the required Ariadne cards, selects the matching operation, and emits
   a compact substrate for `grill-me`/`grill-with-docs`.

The substrate consists of linked Ariadne cards plus a frontier summary. Every
artifact ID referenced in questions, recommendations, or resolution lists is
an inline absolute Markdown link whose href targets the actual persisted
document containing that artifact, not an ID-only reference or invented
per-card path. Every frontier question includes an
`➡️ Recommended answer` derived from `VAL-SELECT-*` or `DEC-*` artifacts.

Ariadne remains the owner of epistemic state. Grill skills own the interview;
`to-spec`, `to-tickets`, and `implement` remain human-controlled delivery
skills. Internal Ariadne tool failures are recorded as observable tooling
artifacts with the error, workaround, impact, and affected component.

## User Stories

1. As an autonomous agent, I want decision-significant uncertainty to activate
   Ariadne before downstream work, so that I do not skip epistemic framing.
2. As an autonomous agent, I want ambiguous requirements to enter the same
   uncertainty route as explicit unknowns, so that activation does not depend
   on the user knowing Ariadne vocabulary.
3. As an autonomous agent, I want routine known-answer questions to avoid the
   deep uncertainty route, so that context load stays bounded.
4. As a user, I want to see the `FRAME-*` artifact before being grilled, so
   that the behavioral problem is visible before mechanism discussion.
5. As a user, I want open `UNK-*` artifacts to be visible, so that I know
   which missing facts can change the decision.
6. As a user, I want `ASM-*` artifacts to expose working premises, so that
   assumptions are not presented as facts.
7. As a user, I want `CTR-*` artifacts to show conflicting requirements, so
   that the interview explores separation rather than asking for an
   unstructured compromise.
8. As a user, I want `HYP-*` artifacts to contain falsification conditions,
   so that proposed causes remain testable.
9. As a user, I want `EVDREQ-*` and `EVD-*` artifacts to distinguish evidence
   requests from evidence results, so that unresolved questions remain honest.
10. As a user, I want candidate mechanisms to be compared across distinct
    principles when a contradiction is active, so that the first idea is not
    treated as the only option.
11. As a user, I want every card mentioned in a question to be a clickable
    absolute Markdown link, so that I can open the source artifact directly.
12. As a user, I want every frontier question to include a recommended answer,
    so that I can review the agent's current best judgment rather than answer
    an unexplained blank question.
13. As a user, I want recommendations to cite the Ariadne cards that support
    them, so that I can challenge the evidence or the unresolved risk.
14. As a user, I want unresolved risks to remain visibly unresolved even after
    I confirm a policy recommendation, so that a human decision is not
    confused with empirical proof.
15. As a user, I want an explicit `grill-me` request to receive Ariadne
    preflight first, so that grilling starts from a prepared decision tree.
16. As a user, I want ordinary uncertainty to route to the appropriate
    Ariadne operation even when grilling was not requested, so that Ariadne is
    useful beyond the grill workflow.
17. As a user, I want `grill-me` and `grill-with-docs` to own interviewing, so
    that Ariadne does not duplicate their question-generation workflow.
18. As a user, I want `to-spec`, `to-tickets`, and `implement` to remain
    human-controlled, so that downstream delivery is not silently launched.
19. As a maintainer, I want one uncertainty rule to own the substrate schema,
    so that handoff fields do not drift across multiple skills.
20. As a maintainer, I want progressive disclosure preserved, so that the
    root skill stays small and detailed rules load only after a signal.
21. As a maintainer, I want tooling failures recorded with their exact
    workaround and impact, so that graph limitations are not hidden in prose.
22. As a maintainer, I want the graph state and frontier state to stay
    synchronized, so that a new session sees the same unresolved work.
23. As a maintainer, I want a pre-decision grill substrate without requiring a
    locked decision, so that open uncertainty can be explored before delivery.
24. As a maintainer, I want semantic gates to explain missing candidate
    breadth before handoff, so that the agent can repair the graph rather than
    bypassing the gate.
25. As a verifier, I want fixture tasks for implicit ambiguity, explicit
    unknowns, routine questions, and explicit grill requests, so that trigger
    recall and false positives are observable.
26. As a verifier, I want to reconstruct the grill frontier from linked cards
    and the compact summary, so that the substrate contract is testable.
27. As a verifier, I want to prove that delivery skills are not auto-invoked,
    so that ownership boundaries remain intact.
28. As a verifier, I want graph structural, semantic, and epistemic gates to
    pass after the new artifacts are created, so that the handoff is valid.

## Implementation Decisions

- Use a two-stage uncertainty ingress: a concise root signal followed by a
  targeted preflight rule.
- Define the activation boundary as decision-significant uncertainty:
  ambiguous requirements, unknown facts, assumptions, competing hypotheses or
  candidates, contradictions, and risky transitions.
- Keep the substrate in existing Ariadne card types and graph state. Do not
  create a second epistemic state model.
- Render a compact frontier summary for grill skills, with every artifact ID
  linked to its actual persisted source document. A card ID may be the visible
  label, but the href must open the real document file.
- Put the recommended answer directly below each frontier question. Derive it
  from a `VAL-SELECT-*` recommendation or a user-confirmed `DEC-*` decision.
- Preserve unresolved empirical risks after a user confirms a policy choice.
- Keep Ariadne as the epistemic owner; keep grill, specification, ticketing,
  and implementation ownership in their existing skills.
- Treat a direct host wrapper as optional and host-specific, not as a core
  dependency.
- Record internal tooling failures as observable Ariadne artifacts containing
  the error, workaround, impact, and affected component.
- Synchronize active frontier and open unknowns whenever graph mutations change
  them.
- Allow a pre-decision substrate for grilling without requiring the
  decision-only handoff generator.

## Testing Decisions

- Test observable activation and handoff behavior, not the wording of a
  particular prompt alone.
- Cover implicit ambiguous requirements, explicit unknowns, assumptions,
  contradictions, competing candidates, risky transitions, and routine
  known-answer questions.
- Verify that the uncertainty preflight creates or links the required cards,
  preserves provenance, exposes unresolved risks, and emits clickable links.
- Verify that every frontier question includes a recommendation sourced from
  an Ariadne selection or decision artifact.
- Verify that explicit grill requests preflight through Ariadne while
  specification, ticketing, and implementation remain human-controlled.
- Verify graph structural, semantic, and epistemic gates after candidate and
  evidence artifacts are present.
- Verify graph/state synchronization and record any failure as a tooling
  observation.
- Use the existing graph, gate, skill-rule, and integration test patterns as
  prior art.

## Out of Scope

- Reimplementing grilling, domain modeling, specification, ticketing, or
  implementation workflows inside Ariadne.
- Automatically invoking `to-spec`, `to-tickets`, or `implement`.
- Making a host-specific cross-skill wrapper a required dependency.
- Treating a user-confirmed recommendation as empirical evidence.
- Redesigning the full Ariadne graph schema beyond the tooling gaps exposed by
  this workflow.
- Adding a separate trace file when the append-only graph and index already
  provide the source of truth.

## Further Notes

The current Ariadne run passed structural, semantic, and epistemic gates after
three candidates were added for the recall/context-load contradiction. The
recommended candidate is the dedicated uncertainty preflight paired with a
minimal canonical root vocabulary.

The run recorded these tooling issues for follow-up: `TRF-*` is rejected as a
source of `derived_from`; `VAL-SELECT-*` is rejected as a source of
`depends_on`; graph mutations do not update `STATE.yaml`; the semantic gate
requires candidate breadth before it can pass an active contradiction; and the
pre-decision handoff generator requires `DEC-*`.
