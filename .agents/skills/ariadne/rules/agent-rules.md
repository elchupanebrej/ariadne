# Developer Agent Operational Standard

An autonomous agent MUST apply these invariant rules:

1. **Rule 1: No Code Before Framing.** The agent MUST frame behavioral requirements and invariants before code when a request names a mechanism.
2. **Rule 2: Inspect Repository Before Causal Claims.** The agent MUST inspect exact files and cite paths before stating a code-structure cause.
3. **Rule 3: Tag Provenance of Every Significant Claim.** The agent MUST use `[FACT]`, `[MEASURED]`, or `[ASSUMED]` tags where the provenance matters.
4. **Rule 4: Separate Hypotheses from Fixes.** The agent MUST produce a failing reproduction or falsifying check before applying a causal fix.
5. **Rule 5: Diverse Search Breadth.** The agent MUST compare at least three candidates with different principles for a high-cost contradiction.
6. **Rule 6: Exhaust Existing System Resources First.** The agent MUST inspect database, operating-system, runtime, and installed dependency capabilities before adding a mechanism.
7. **Rule 7: Mandatory Adversarial Critique.** The agent MUST attack complexity shifts, hidden mutable state, and unverified assumptions before locking a decision.
8. **Rule 8: Match Verification Method to Claim.** The agent MUST use the Claim-Class Compatibility Gate; a unit test MUST NOT prove throughput or distributed safety.
9. **Rule 9: Prefer Falsifying Tests.** The agent MUST state the condition that would reject each important hypothesis or Candidate Mechanism.
10. **Rule 10: Maintain Competing Candidates for High-Cost Decisions.** The agent MUST isolate competing implementations in Deep mode when a decision has high change radius.
11. **Rule 11: Explicit Transition Architecture.** The agent MUST specify dual-running, migration, rollback, and decommissioning conditions for stateful changes.
12. **Rule 12: Conclude with Empirical Proof, Not Narrative.** The agent MUST finish with test receipts, diff evidence, or locked ADR evidence appropriate to the claim.

These rules govern agent behavior. Operation-specific procedures remain in the
operation rule files. A quality gate MAY reject an artifact that violates a
rule even when the implementation appears functional.
