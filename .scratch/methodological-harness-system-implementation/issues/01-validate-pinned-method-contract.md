# 01 — Validate and resolve a pinned Method Contract

**What to build:** Give a method maintainer one public path that accepts a pinned `method-contract/1` manifest and returns a deterministic validated contract, its verified owner version and byte digest, the selected Completion Profile, and the obligations and verification hooks that follow from that profile.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A valid closed UTF-8 JSON envelope produces the same normalized result on repeated validation.
- [x] Every A0–A7 record has a stable identifier, operational role, embedded JSON Schema predicate, and resolvable rationale reference.
- [x] Rule records expose their trigger, inputs, ordered actions, branches, output, recovery, escalation, and rationale using only supported effects.
- [x] Each Completion Profile resolves to explicit obligations and hooks while keeping external-verification and self-consistency receipts distinct.
- [x] The returned pin binds the owner-native version to the digest of the exact validated bytes.
- [x] Verification exercises the public validation boundary rather than internal helper calls.

## Comments

- Implemented public validation and resolution boundary for `method-contract/1` manifests in `src/method-contract/`.
- Implemented Zod schemas for closed envelopes, artifact records (A0–A7), rule records with supported effects, completion profiles, verification hooks, and lifecycle metadata.
- Implemented deterministic canonical normalization, SHA-256 byte digest computation, and profile resolution separating external-verification and self-consistency receipts.
- Full test suite passed (34 test files, 327 tests), including 20 dedicated tests in `tests/method-contract/validation.test.ts`.

