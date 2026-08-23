# Harness Research and Architecture Reference

Version: 2026.1
Digest: `sha256:harness-research-reference-v1`

## Key Architecture Principles

1. **Failure-Driven Mechanism Addition**: Do not add queues, databases, background daemons, or complex orchestration layers until an observable lifecycle failure requires them.
2. **Single Ownership**:
   - **Method Contract**: Method rules, obligations, stops, completion predicates.
   - **Tracker / Matt Skills**: Work state, tasks, conversation history, pull request status.
   - **Ariadne**: Epistemic claims, evidence, uncertainty nodes, decisions, invalidation cascades.
   - **Host Runtime**: Model/tool loop, native permissions, sandboxing, approvals, native traces.
   - **Orchestration Harness**: Attempt pointers, generic gates, pending action references, normalized lifecycle events.
3. **Pointer-Only Architecture**: State is never duplicated or copied into the harness. The harness maintains content-addressed or resolvable URI pointers.
4. **Fail-Closed Operations**: Pin mismatches, corrupt envelopes, unsupported capabilities, or ambiguous side effects halt execution cleanly rather than guessing or continuing unsafely.
5. **No Automatic Replay of Ambiguous Side Effects**: When process loss occurs after an external side effect, the harness must wait for an owner inspection receipt rather than replaying the effect.
6. **Kernel Deletion Discipline**: If a thin baseline (e.g. prompt loader + repository files) satisfies all hard requirements for a domain task, the orchestration kernel must be trimmed/deleted.
