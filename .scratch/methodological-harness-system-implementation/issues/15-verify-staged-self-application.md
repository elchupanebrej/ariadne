# 15 — Perform staged self-application and fixed-point verification

**What to build:** Run an immutable, owner-gated bootstrap in which the guide and Method Contract produce the Teaching Skills and Harness Authoring result, followed by two isolated complete assessments that must agree with the input contract's normalized normative projection.

**Blocked by:** 06 — Verify Methodological Guide transfer and recovery; 08 — Verify Harness Authoring transfer and deletion discipline; 14 — Close the optional Orchestration Kernel branch.

**Status:** resolved

- [x] Each bootstrap round pins exact owner versions and byte digests and never rewrites an active input.
- [x] Build order remains guide, Method Contract, Methodology Authoring Teaching Skill, Harness Authoring Teaching Skill, optional kernel disposition, then two isolated assessments.
- [x] Each assessor emits complete artifacts, audit and leave-one-out results, a change-propagation matrix, a contract candidate, normalized projection, and pin, completion, independence, and no-circular-validation receipts.
- [x] Normalization removes only release-instance metadata and preserves executable order, predicates, rules, and normative links.
- [x] Promotion requires `N(F_A(M_n)) = N(M_n) = N(F_B(M_n))` with exact normalized equality.
- [x] Any delta, disagreement, pin drift, missing independence, unresolved stop, or runtime cycle halts; an accepted delta starts a new immutable round.
- [x] Structural self-consistency remains separate from teaching, adapter, kernel-necessity, and recovery claims.

## Comments

Implemented the immutable bootstrap in `src/harness/self-application.ts` with 9 tests (`tests/harness/self-application.test.ts`). Each round writes its inputs+pins once under `<root>/round-<n>/` and refuses re-initialization (immutability); five input pins carry declared owner versions and real sha256 byte digests — the kernel-disposition pin digests the file's actual bytes (content is required, not the ref string) — and reload verifies every pin including truncation detection before any assessment runs. The stage sequencer enforces the exact build order and halts on out-of-order entry or repeated invocation as a runtime cycle. Assessors A and B run over fresh clones in distinct workspaces: audit derives from rationale-link resolution, leave-one-out computes per-artifact completion verifiability, the change-propagation matrix maps each rule to its effect kinds and touched profiles, and pin/completion/independence/no-circular-validation receipts are derived checks (a hook owned by the assessing identity would fail circularity). An unresolved stop effect anywhere in rule actions or branches halts fail-closed. Normalization strips only effective/changelog dates — verified equal across differing release instances and unequal under rule reordering, predicate change, or link change. Promotion requires the exact three-way normalized equality; assessor disagreement yields a non-promoted record, an accepted delta becomes a fresh round 2 that promotes, and pin drift halts the drifted round.

Review-driven changes: replaced the test-only mutation hook with a named assessor-B derivation seam, made audit/leave-one-out/receipts derived rather than hardcoded true, added unresolved-stop detection, required disposition file content for genuine byte pinning, closed a truncated-pin-list fail-open, extracted duplicated effect flattening, corrected the normalization comment (executor stamps do not exist in the schema), and annotated the mandatory-disposition-stage semantics plus the ticket-14 evidence addendum.
