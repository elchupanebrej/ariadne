# 02 — Reject unsafe Method Contract changes

**What to build:** Make malformed, ambiguous, or overpowered Method Contract inputs fail closed with actionable diagnostics, and prove that the validator detects critical defects rather than merely accepting the happy path.

**Blocked by:** 01 — Validate and resolve a pinned Method Contract.

**Status:** ready-for-agent

- [ ] Unknown envelope fields, unresolved rationale, invalid predicates, bad pins, and unsupported effects are rejected before publication or use.
- [ ] Arbitrary scripts, callbacks, general expression languages, and prose-derived completion cannot enter the contract.
- [ ] External-verification and self-consistency receipts cannot satisfy one another.
- [ ] Failure returns stable diagnostics and leaves no partially accepted contract or lifecycle state.
- [ ] Mutation testing reaches an MSI of at least 85 percent, with every critical isolation, ownership, evidence, lifecycle, circularity, and deletion mutant killed.
