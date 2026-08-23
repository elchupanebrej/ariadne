# 04 — Verify Ariadne fading, transfer, and recovery

**What to build:** Demonstrate that Ariadne learning transfers beyond the worked parser path by completing a less-guided analogous case, routing a structurally changed case, and repairing only the failed artifact or owner boundary when recovery is required.

**Blocked by:** 03 — Teach Ariadne through a complete parser decision.

**Status:** resolved

- [x] A faded native query-string case reproduces the candidate-selection and evidence shape with materially less guidance.
- [x] A duplicate-effect retry case selects the changed Diagnose and Dynamics route rather than copying the parser route.
- [x] Targeted recovery repairs an invalid artifact, evidence mismatch, or owner-boundary failure without restarting unrelated work.
- [x] Every run records declared and prohibited inputs, interventions, route choices, artifacts, and receipts.
- [x] Normative content remains in live Ariadne rules and Method Contract records rather than being copied into the Teaching Skill.
- [x] Recall, faded performance, structural transfer, and recovery are reported as separate claims.

## Comments

- Built deterministic query string parser engine in `src/teach-ariadne/querystring.ts` emitting verified Rung 3 evidence receipt `EVD-querystring-parser-r3`.
- Implemented faded case completion (`completeFadedCase`) reproducing candidate selection (`CAN-urlsearchparams-stdlib`), hard requirement filtering (rejecting `CAN-qs-package` and `CAN-regex-split`), and locking `DEC-querystring-parser` in the isolated graph.
- Implemented structurally changed transfer routing (`routeTransferCase`) for network timeout retry loops, progressively loading Diagnose (`20-diagnose.md`) and Dynamics (`70-dynamics.md`) rules to generate `DIAG-duplicate-invoices-timeout`, `DYN-client-server-retry-race`, and `DEC-idempotency-key-dedup`.
- Implemented targeted recovery operations (`repairArtifact`, `recoverEvidence`, `repairOwnerBoundary`) preserving existing valid nodes and edges without restarting unrelated work.
- Implemented structured run reporting (`getRunReport`) tracking declared inputs, prohibited inputs, author interventions, route choices, artifacts, and evidence receipts.
- Implemented 4-claim evaluation reporting (`getClaimsReport`) separately validating `recall`, `faded_performance`, `structural_transfer`, and `targeted_recovery` without compensatory trade-offs.
- Full verification passed: 38 test files, 395 tests, clean typecheck.
