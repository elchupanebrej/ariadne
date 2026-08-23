# 06 — Verify Methodological Guide transfer and recovery

**What to build:** Demonstrate that a fresh session can author a different guide with less support, transfer the method to a metamethodological case without runtime recursion, and recover precisely from invalid inputs or authority boundaries.

**Blocked by:** 05 — Teach Methodological Guide authoring through dependency review.

**Status:** resolved

- [x] A faded incident-handoff case produces every A0–A7 artifact triggered by its observed signals with less guidance.
- [x] A metamethodological case transfers the method without making an active method, builder, or harness invoke or rewrite itself.
- [x] Pin, artifact, rationale, authority, and circularity failures stop at the affected boundary with targeted recovery.
- [x] Version, ownership, feedback, deviation, and retirement decisions retain resolvable provenance.
- [x] Runs complete without undeclared author intervention or hidden source material.
- [x] Faded performance, structural transfer, recovery, and acyclicity are reported separately.

## Comments

### Implementation & Verification Summary
- **Faded Case Practice (`src/teach-methodology/incident-handoff.ts`)**:
  - Implemented complete `createIncidentHandoffGuideProject()` and `createIncidentHandoffDeclaredManifest()` covering all triggered A0–A7 artifacts for production on-call handoffs.
  - Defined explicit roles with non-synthesized authority (`outgoing_oncall`, `incoming_oncall`, `incident_commander`, `service_owner`, `guide_owner`).
  - Added session integration via `completeFadedCase()` requiring prior self-explanation and validating schema compliance.
- **Metamethodological Transfer (`src/teach-methodology/metamethodology.ts`)**:
  - Created metamethodological transfer fixture and manifest utilizing `metamethodological` completion profile and separate fixed-point `self_consistency` receipts.
  - Enforced strict build-time immutable input metadata (`immutable_round: "round-1"`, `build_time_input: true`, `self_invocation: false`, `active_rewriting: false`).
  - Integrated `routeTransferCase()` fail-closed routing that rejects attempts at self-invocation or active builder/guide rewriting.
- **Targeted Recovery at Affected Boundaries (`src/teach-methodology/session.ts`)**:
  - Implemented precise recovery methods: `repairPin`, `repairArtifact`, `repairAuthority`, `repairRationaleLink`, `repairCircularity`.
  - Maintained fail-closed state (`blocked`) while unresolved faults persist; uncorrupted artifacts and valid partial state are preserved throughout recovery.
- **A7 Provenance & Lifecycle Log Verification (`src/teach-methodology/verifier.ts`)**:
  - Validated resolvable lifecycle logs covering versions, owners, feedback, deviations, and retirement dispositions across both ordinary and metamethodological guide projects.
- **Multi-Claim Evaluation & Clean Execution Reporting**:
  - Implemented `getRunReport()` ensuring 0 prohibited inputs and 0 undeclared interventions on clean sessions.
  - Implemented `getClaimsReport()` reporting `faded_performance`, `structural_transfer`, `targeted_recovery`, and `acyclicity` independently with non-compensatory pass/fail grading.
- **Tests & Runnable Checks**:
  - Verified 19 targeted transfer and recovery tests in `tests/teach-methodology/transfer-and-recovery.test.ts`.
  - Updated and verified standalone runnable check `node .agents/skills/teach-methodology/example/check.mjs`.
  - All 40 test files (429 tests) across the repository pass cleanly.
