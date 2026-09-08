# 19 — Make Journal Recovery Fail Closed on Corruption

**What to build:**
Make workspace reopening and recovery distinguish a safely truncatable incomplete final frame from corruption that must stop the operation. Recovery must validate framing, checksums, sequence continuity, record schemas, and projection input types before rebuilding derived state.

**Blocked by:** 18

**Status:** resolved

- [x] An incomplete final frame is repaired only when it is provably an incomplete tail.
- [x] Malformed, schema-invalid, checksum-invalid, out-of-sequence, and middle-corrupted records fail closed.
- [x] Recovered event payloads are schema-validated before they affect projections.
- [x] Projection rebuilding reports invalid input instead of silently skipping it.
- [x] Mixed-version persisted authorities are detected and rejected consistently.
- [x] Recovery diagnostics identify the workspace, record location, failure class, and safe next action without leaking secrets.
- [x] Scenario tests cover repair, refusal, and repeated reopen behavior.

## Comments

### Implementation and verification (2026-09-08)

Implemented fail-closed framed-journal recovery with explicit validation for framing, checksums, sequence continuity, payload schemas, persisted versions, and sanitized diagnostics. Final JSON repair now requires evidence of an unfinished object/string at EOF; complete malformed or invalid records remain untouched and rejected. Attempt reads repair only provably incomplete tails while preserving non-mutating reads of complete records without a trailing newline.

Verification: the four recovery-focused suites passed 43/43 tests; the six relevant persistence/recovery suites passed 58/58 tests; `npm run typecheck` and `npm run build` passed; the full `npm test` suite passed 76 files and 866 tests. The implement-skill code review found no standards or specification findings.
