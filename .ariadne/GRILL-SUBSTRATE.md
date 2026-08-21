# Ariadne Grill Substrate

This artifact is the pre-decision epistemic substrate for a grill.
The graph may still contain unresolved unknowns; no decision is required.

## Facts and observations

- [DEC-artifact-links-target-files](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [DECIDED] Every artifact reference shown to the user must link to the actual persisted document path that can be opened from the dialog. The visible label may be a card ID, but the href must target the real Markdown, YAML, JSONL,…
- [DEC-uncertainty-interaction-contract](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [DECIDED] Ariadne is the uncertainty ingress and epistemic substrate provider. It activates for decision-significant uncertainty, runs a targeted preflight, records linked epistemic cards, and gives grill-me/grill-with-docs a fro…
- [EVD-static-uncertainty-coverage](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [FACT] The repository defines Ariadne semantics for engineering uncertainty and decision-significant unknowns, but the current root skill routes specialized operations and lacks an explicit general-uncertainty ingress plus a c…
- [OBS-ariadne-flow-missed](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [FACT] In the prior session, the agent edited Ariadne documentation but did not run the requested Ariadne reasoning flow before asking frontier questions.
- [OBS-ariadne-tooling-failures](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [FACT] The Ariadne CLI and graph workflow exposed five operational/tooling problems during artifact creation.

## Frames

- [FRAME-uncertainty-substrate](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] For work with decision-significant uncertainty, Ariadne detects the uncertainty, records an epistemic substrate, and hands that substrate to the next reasoning skill before grilling, specification, ticketing, or impleme…

## Invariants

- None

## Assumptions

- [ASM-matt-ownership-boundary](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [ASSUMED] Matt skills own interviewing, specification, ticketing, and implementation workflows, while Ariadne owns claims, assumptions, unknowns, hypotheses, evidence, provenance, and invalidation.

## Contradictions

- [CTR-recall-vs-context-load](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] A broader Ariadne uncertainty signal improves recall of genuinely uncertain work but increases context load and false-positive activation for routine work.

## Evidence and requests

- [EVD-static-uncertainty-coverage](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [FACT] The repository defines Ariadne semantics for engineering uncertainty and decision-significant unknowns, but the current root skill routes specialized operations and lacks an explicit general-uncertainty ingress plus a c…
- [EVDREQ-static-uncertainty-coverage](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] Inspect the root Ariadne skill, uncertainty rules, project specification, and downstream Matt skill contracts to determine whether general uncertainty activation and epistemic handoff are explicitly defined.

## Open unknowns

- [UNK-auto-handoff-policy](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [UNKNOWN] Whether Ariadne should automatically prepare a substrate whenever grill-me/grill-with-docs is requested, while leaving to-spec, to-tickets, and implement human-controlled.
- [UNK-grill-handoff-shape](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [UNKNOWN] Which minimum Ariadne artifact set gives grill-me/grill-with-docs enough epistemic substrate without duplicating its interview tree?
- [UNK-uncertainty-trigger-boundary](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [UNKNOWN] Which observable task signals are sufficient to activate Ariadne before downstream work?

## Candidates and hypotheses

- [CAN-cross-skill-wrapper](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] Add an integration wrapper that invokes Ariadne preflight before grill-me/grill-with-docs and serializes a handoff packet at the skill boundary.
- [CAN-root-uncertainty-preflight](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] Add a targeted rules/05-uncertainty.md preflight that confirms decision significance, records FRAME-linked unknowns/assumptions/contradictions, selects the next Ariadne operation, and emits a compact grill substrate.
- [CAN-root-uncertainty-vocabulary](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] Add a concise root trigger vocabulary for decision-significant uncertainty, ambiguous requirements, assumptions, contradictions, competing hypotheses or candidates, unknown facts, and risky transitions.
- [HYP-missing-epistemic-handoff](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] Even when Ariadne activates, the absence of a defined substrate handoff lets grill/specification/delivery work proceed without explicit facts, open unknowns, provenance, and decision frontier.
- [HYP-narrow-root-trigger](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) [PROPOSED] The current Ariadne root description emphasizes specialized mechanisms and does not provide a strong semantic trigger for general decision-significant uncertainty.

## Frontier questions

- [UNK-auto-handoff-policy](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) ❓ Whether Ariadne should automatically prepare a substrate whenever grill-me/grill-with-docs is requested, while leaving to-spec, to-tickets, and implement human-controlled.
  ➡️ Recommended answer: [VAL-SELECT-uncertainty-ingress](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) — Recommend the dedicated uncertainty preflight as Ariadne's core mechanism, preceded by a concise canonical trigger vocabulary; keep a cross-skill wrapper optional and host-specific.
- [UNK-grill-handoff-shape](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) ❓ Which minimum Ariadne artifact set gives grill-me/grill-with-docs enough epistemic substrate without duplicating its interview tree?
  ➡️ Recommended answer: [VAL-SELECT-uncertainty-ingress](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) — Recommend the dedicated uncertainty preflight as Ariadne's core mechanism, preceded by a concise canonical trigger vocabulary; keep a cross-skill wrapper optional and host-specific.
- [UNK-uncertainty-trigger-boundary](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) ❓ Which observable task signals are sufficient to activate Ariadne before downstream work?
  ➡️ Recommended answer: [VAL-SELECT-uncertainty-ingress](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRILL-SUBSTRATE.md>) — Recommend the dedicated uncertainty preflight as Ariadne's core mechanism, preceded by a concise canonical trigger vocabulary; keep a cross-skill wrapper optional and host-specific.

## Source artifacts

- [GRAPH.jsonl](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/GRAPH.jsonl>)
- [INDEX.md](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/INDEX.md>)
- [STATE.yaml](</mnt/c/Users/bulky/Projects/ariadne/.ariadne/STATE.yaml>)
