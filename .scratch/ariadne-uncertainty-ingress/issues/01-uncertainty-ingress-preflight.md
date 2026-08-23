# 01 — Uncertainty ingress preflight

**What to build:** Ariadne detects decision-significant uncertainty before downstream work and produces a validated epistemic substrate with the appropriate operation frontier.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [ ] Ambiguous requirements, unknown facts, assumptions, competing hypotheses or candidates, contradictions, and risky transitions route through the uncertainty preflight.
- [ ] Routine known-answer questions remain outside the deep uncertainty route.
- [ ] The preflight creates or links the required Ariadne cards and preserves provenance and unresolved risks.
- [ ] The preflight selects the next Ariadne operation without invoking grilling or delivery skills internally.
- [ ] Structural, semantic, and epistemic gates pass for the preflight artifacts.

## Comments

Implemented `src/adapters/ariadne/preflight.ts`: six signal detectors (ambiguity/unknown/assumption/candidates/contradiction/risky transition) with routine known-answer exclusion; deterministic next-operation selection mirroring the SKILL router order (no grill/delivery invocation); substrate builder emitting FRAME/UNK/ASM/CAN/CTR/EVDREQ/OBS cards with provenance, unresolved risks, and GRAPH.jsonl source pointers. Tests: `tests/harness/uncertainty-ingress.test.ts`. Review fixes: risky transitions surface as OBS observations (formal TRANS cards require validate-operation fields); unknown facts always co-emit an EVDREQ.
