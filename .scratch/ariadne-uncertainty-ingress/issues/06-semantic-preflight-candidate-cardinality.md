# 06 — Close semantic preflight candidate-cardinality gap

**What to build:** Ensure semantic preflight diagnostics reject insufficient numbers of structurally distinct candidates even when one candidate lists multiple separation principles, while preserving the active Fast/Standard/Deep thresholds and the strict semantic gate.

**Blocked by:** None

**Status:** ready-for-human

- [x] A single candidate with multiple separation principles is diagnosed as insufficient in Standard and Deep modes.
- [x] Diagnostics report required and actual candidates plus covered and uncovered principles without mutating graph state.
- [x] The completed three-candidate graph still passes the semantic gate.
- [x] Regression coverage proves both the insufficient-cardinality and completed-graph cases.

## Comments

- Implemented and verified on 2026-08-21: full `npm run verify` passes with 32 test files and 243 tests; focused gate coverage passes 12/12.
