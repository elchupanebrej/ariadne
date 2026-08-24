---
name: methodize-harness
description: Teach a fresh agent to design an orchestration harness from an observed continuation failure.
disable-model-invocation: true
---

# Harness Authoring Teaching Skill

Teach a fresh agent session to design a minimal, owner-safe agent orchestration harness from an observed continuation failure, placing every responsibility with its existing owner and testing the thin baseline before retaining a new boundary.

All relative paths in this lesson (`bootstrap.lock`, `example/`, `references/`) resolve from this skill's directory, not the repository root.

## Learning Path

1. **Meaningful Task First**: Present the cross-session continuation failure task before naming harness components or architecture.
2. **Pinned Sources**: Load `bootstrap.lock`; resolve and validate exact `G_n`, `M_n`, `MA_n`, harness research, workspace revision, and host capability versions and digests.
3. **Outcome Requirements**: Define repository-observable success, failure, waiting, and stop outcomes before selecting an architecture.
4. **Single Ownership Boundary**: Assign every datum and enforcement responsibility to the Method Contract, Tracker (Matt skills), Ariadne, Host, or Orchestration Harness. Prohibit shadow state or copied owner payloads.
5. **Test the Thin Baseline**: Measure the thin skill-loader-plus-owner-artifacts baseline. Retain a new boundary only for an observed failed hard invariant.
6. **Non-Compensatory Candidate Filtering**: Filter the thin baseline, host-specific plugin, and minimal neutral kernel against hard invariants (continuation, host neutrality, side-effect safety).
7. **Triggered Mechanisms Only**: Add only mechanisms whose observable condition fired (context manifest, attempt cursor, receipt gates, host adapter, pending approval pointer, idempotency/replay declaration, normalized events, pin gate).
8. **Pointer-Only Artifact Contract**: Express context manifests, attempt cursors, artifact envelopes, pending actions, and events as resolvable pointers without copied payloads.
9. **Ambiguous Side-Effect Recovery**: Stop retries on process loss after side effects; await owner inspection receipt and resume without automatic replay.
10. **Lifecycle Fixtures**: Evaluate cold start, mid-run reset, approval wait, ambiguous effect, corrupt artifact, and pin drift fixtures.
11. **Lifecycle & Deletion Rule**: Record owner pins, review triggers, and the explicit rule to inline or delete the kernel when a thinner baseline satisfies all required invariants.
12. **Self-Explanation**: Answer why prompts citing live sources after runnable checks pass.
13. **Faded Practice**: Complete the faded issue-triage continuation case with withheld owner maps, verdicts, and recovery policies.
14. **Staged Transfer**: Route staged self-application where `HA_n` builds `OH_n`, which coordinates two isolated applications of `M_n` without runtime recursion.

## Complete Worked Example: Dependency-Review Continuation Harness

- **Task**: Design the smallest host-neutral harness that executes the dependency-change review method across fresh sessions, preserves a security approval wait, and does not duplicate a review publication after process loss.
- **Directory**: `example/`
- **Inputs**: `example/input/dependency-review-run.json`
- **Solution**: `example/solution/harness-project.json`
- **Verification**: `node example/check.mjs`

## Self-Explanation Prompts

After the runnable check passes, the learner must answer:

1. **Observed Triggers**: Which observed lifecycle failure justified each retained harness mechanism?
2. **Pointer Contract**: Why does the harness store resolvable owner pointers rather than copying owner payloads into its ledger?
3. **Deletion Rule**: Why does a passing thin baseline eliminate the proposed kernel?
4. **Ambiguous Effects**: Why must the harness enter waiting and await an owner inspection receipt instead of automatically replaying an ambiguous side effect?
5. **Acyclic Transfer**: Why must `HA_n` and `OH_n` never invoke or rewrite their active builders at runtime?

## Runnable Completion Check

```sh
node example/check.mjs
```
