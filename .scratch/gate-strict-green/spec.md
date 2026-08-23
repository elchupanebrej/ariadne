# Spec: gate-strict-green

## Goal

Make Ariadne's strict quality gates truthful and green: the teach-ariadne
worked example must pass the real CLI gates, and the repo-root epistemic
overlay must clear its outstanding diagnostics honestly — no fabricated
receipts.

## Scope

1. Convert `teach-ariadne/example/.ariadne/GRAPH.jsonl` to the CLI event
   schema so all three strict gates can load it.
2. Make the skill's documented completion check run parser assertions and the
   real gate on the example from one command at the repo root.
3. Disposition every `MISSING_EVIDENCE_RESULT` at repo root: link, produce, or
   remove-with-rationale (never fabricate).
4. Record substantive adversarial critiques for locked decisions flagged by
   the epistemic gate.
5. Verify end to end: typecheck, full vitest suite, and `gate all --strict`
   exit 0.

## Out of scope

Producing the heavyweight studies the removed requests described (r5 mutation
testing, r6 conformance/transfer arms, r8 fault injection). Those are re-filed
when the underlying work starts.

## Decisions

- The epistemic gate has no "cancelled request" representation: any materialized
  EVDREQ without linked evidence is flagged regardless of status, so aspirational
  requests are physically removed from current state with rationale recorded in
  ticket comments; git history preserves the events.
- Forward-looking evidence-pointer arrays on active nodes are scrubbed of dead
  IDs; prose narratives and OBS histories are left untouched.
