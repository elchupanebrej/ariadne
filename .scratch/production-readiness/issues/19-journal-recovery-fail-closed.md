# 19 — Make Journal Recovery Fail Closed on Corruption

**What to build:**
Make workspace reopening and recovery distinguish a safely truncatable incomplete final frame from corruption that must stop the operation. Recovery must validate framing, checksums, sequence continuity, record schemas, and projection input types before rebuilding derived state.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] An incomplete final frame is repaired only when it is provably an incomplete tail.
- [ ] Malformed, schema-invalid, checksum-invalid, out-of-sequence, and middle-corrupted records fail closed.
- [ ] Recovered event payloads are schema-validated before they affect projections.
- [ ] Projection rebuilding reports invalid input instead of silently skipping it.
- [ ] Mixed-version persisted authorities are detected and rejected consistently.
- [ ] Recovery diagnostics identify the workspace, record location, failure class, and safe next action without leaking secrets.
- [ ] Scenario tests cover repair, refusal, and repeated reopen behavior.
