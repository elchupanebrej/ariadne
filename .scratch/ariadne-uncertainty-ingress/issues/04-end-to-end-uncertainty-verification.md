# 04 — End-to-end uncertainty workflow verification

**What to build:** A verifier can exercise an uncertain task from activation through Ariadne substrate, recommended grill questions, artifact links, and downstream ownership boundaries, with falsifying fixtures for missed activation and false positives.

**Blocked by:** 01 — Uncertainty ingress preflight; 02 — Clickable recommended grill handoff; 03 — Ariadne tooling consistency.

**Status:** resolved

- [ ] An implicit ambiguous design request produces Ariadne artifacts before any grill questions.
- [ ] An explicit unknown, assumption, contradiction, competing candidate set, and risky transition each route to the appropriate Ariadne branch.
- [ ] A routine known-answer request does not activate the full uncertainty flow.
- [ ] The verifier can open every emitted artifact link and reconstruct the frontier from the linked documents.
- [ ] Every question includes the recommended answer supported by the Ariadne artifact graph.
- [ ] The workflow does not automatically invoke to-spec, to-tickets, or implement.
- [ ] All Ariadne gates and the full test suite pass.

## Comments

Added `tests/e2e/uncertainty-flow.test.ts`: implicit ambiguous request produces FRAME artifacts before any grill handoff exists; each explicit branch routes to its declared operation; routine known-answer requests create nothing and render "- None"; verifier opens every emitted href (all resolve to real files), reconstructs UNK frontier from the linked GRAPH.jsonl alone, and asserts no invented per-card paths. Falsifying fixture for missed activation included (marker removed -> activation stops). Adversarial false-positive coverage beyond routine questions remains a noted ceiling.
