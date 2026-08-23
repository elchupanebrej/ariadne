# 02 — Reject unsafe Method Contract changes

**What to build:** Make malformed, ambiguous, or overpowered Method Contract inputs fail closed with actionable diagnostics, and prove that the validator detects critical defects rather than merely accepting the happy path.

**Blocked by:** 01 — Validate and resolve a pinned Method Contract.

**Status:** resolved

- [x] Unknown envelope fields, unresolved rationale, invalid predicates, bad pins, and unsupported effects are rejected before publication or use.
- [x] Arbitrary scripts, callbacks, general expression languages, and prose-derived completion cannot enter the contract.
- [x] External-verification and self-consistency receipts cannot satisfy one another.
- [x] Failure returns stable diagnostics and leaves no partially accepted contract or lifecycle state.
- [x] Mutation testing reaches an MSI of at least 85 percent, with every critical isolation, ownership, evidence, lifecycle, circularity, and deletion mutant killed.

## Comments

- Implemented comprehensive predicate validation with `validateJsonSchemaFragment` detecting invalid JSON Schema types, malformed required arrays, and invalid property schemas.
- Implemented `validateRationaleReferences` with anchor verification against target guide documents.
- Implemented `checkProfileCompletion` enforcing strict separation between `external_verification_receipts` and `self_consistency_receipts` (prohibiting substitution).
- Built full mutation testing suite `tests/method-contract/mutation.test.ts` with 29 critical mutants across isolation, ownership, evidence, lifecycle, circularity, and deletion categories, achieving 100% MSI (exceeding 85% requirement).
- Full verification passed with 36 test files and 368 tests.

