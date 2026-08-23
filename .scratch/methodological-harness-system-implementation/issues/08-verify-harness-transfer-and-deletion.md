# 08 — Verify Harness Authoring transfer and deletion discipline

**What to build:** Demonstrate that Harness Authoring transfers to different continuation problems, recovers fail-closed, and removes any Teaching Skill or harness mechanism that adds no observable value over the matched thinner path.

**Blocked by:** 07 — Teach Harness Authoring through a thin continuation path.

**Status:** resolved

- [x] A faded issue-triage continuation case selects only mechanisms linked to observed lifecycle failures.
- [x] A staged-self-application transfer case preserves the acyclic build-time boundary and treats runtime recursion as failure.
- [x] Invalid pointers, ownership conflicts, ambiguous effects, and unsupported capabilities stop with targeted recovery.
- [x] Every retained mechanism has one owner, one observed trigger, and one executable necessity criterion.
- [x] A matched run without the Teaching Skill uses the same pinned task, sources, capabilities, and critical criteria.
- [x] The Teaching Skill or added mechanism is deleted or inlined when the thinner baseline passes; variable evidence remains inconclusive.

## Comments

### 2026-08-23 — Implementation and Verification Complete

- Implemented `createIssueTriageDeclaredManifest` and `createIssueTriageHarnessProject` in `src/teach-harness/issue-triage.ts`, selecting only mechanisms linked to observed issue triage lifecycle failures (attempt cursor, context manifest, pending human approval pointer, and 5-role triage validation gate).
- Implemented `createStagedSelfApplicationDeclaredManifest` and `createStagedSelfApplicationHarnessProject` in `src/teach-harness/staged-self-application.ts`, enforcing strict acyclic build-time boundaries and failing closed upon active self-invocation or runtime recursion.
- Implemented targeted recovery methods (`repairPin`, `repairPointer`, `repairOwnership`, `recoverAmbiguousEffect`, `repairCapability`, `repairRuntimeRecursion`) that repair affected boundaries in place without wiping valid work.
- Enforced single ownership, observed triggers (`trigger_observed: true`), and executable necessity criteria in `verifyHarnessProject`.
- Added run report audit trail with comparison arms sharing identical pinned tasks, sources, capabilities, and critical criteria.
- Implemented multi-claim evaluation reporting (`faded_performance`, `structural_transfer`, `targeted_recovery`, `mechanism_necessity`, `deletion_discipline`) with non-compensatory scoring and deletion discipline when thin baseline passes.
- Verified via `tests/teach-harness/transfer-and-recovery.test.ts`, `tests/teach-harness/teaching-session.test.ts`, and standalone `check.mjs`.
