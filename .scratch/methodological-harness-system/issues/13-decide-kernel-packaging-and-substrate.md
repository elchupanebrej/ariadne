# Decide kernel packaging and implementation substrate

Type: prototype
Status: resolved
Blocked by: 03, 09, 10, 12
Parent: [Methodological Harness System](../map.md)

## Question

What is the smallest physical packaging, process model, technology stack, repository location, ledger representation, and atomicity/locking substrate that implements the minimum Orchestration Harness contract using existing project capabilities, preserves direct Matt Pocock Skills and Ariadne use, and remains easy to delete or inline if the clean-session baseline passes?

## Comments

- Repository inspection found that `src/harness/controller.ts` is the Ariadne-owned epistemic integration seam: it selects providers, projects GSD, normalizes Matt artifacts into Ariadne nodes, and persists `GraphStorage`. Reusing it for neutral orchestration attempts would merge state ownership even though its local atomic-file pattern is reusable.
- [Throwaway kernel packaging and substrate prototype](../prototypes/13-kernel-packaging-substrate.throwaway.html) exercises four candidates across happy path, crash-after-invocation recovery, concurrent resumers, invalid pins, partial JSONL tail recovery, direct Matt/Ariadne use, and kernel deletion. Its embedded self-check reports `10 deterministic paths and 4 candidate filters passed`; SHA-256 `092b45afa619d57878a50d68e88b712663e33c780ef1f633268db69c917230cf`.
- Provisional recommendation for review: one owner-neutral internal module at `src/orchestration/`, invoked in-process or by a one-shot CLI, using Node 20, TypeScript, installed Zod, and `fs/promises`; store one append-only ledger per attempt at `.orchestration/attempts/<id>.jsonl`; serialize with a per-attempt directory lock, expected revision, temp rewrite, and same-volume atomic rename. Add no package, daemon, database, queue, scheduler, IPC, global lock, or Ariadne graph records.
- The thin owner-artifact path remains the Rung 6 deletion baseline. Delete or inline the module if that matched Clean-Session Run satisfies every hard invariant; Rung 8 must still test real filesystem crashes, stale locks, concurrent resumers, partial writes, and owner boundaries.
- [`EVD-kernel-packaging-prototype-r3`](../../../.ariadne/GRAPH.jsonl) records the deterministic prototype receipt; [`VAL-SELECT-kernel-packaging-substrate`](../../../.ariadne/GRAPH.jsonl) records the provisional non-compensatory selection and adversarial critique.
- Post-prototype Ariadne structural and semantic gates pass. Epistemic gating reports no ticket 12 or 13 artifact defect; it remains stopped by the five intentional downstream Rung 5/6/8 evidence requests and one pre-existing unrelated critique diagnostic. [`OBS-kernel-packaging-post-prototype-gate`](../../../.ariadne/GRAPH.jsonl) records the exact result.
- The user accepted the provisional recommendation and its deletion condition.

## Answer

If a kernel survives the matched Clean-Session Run, use **one co-located, owner-neutral internal module** at `src/orchestration/`. Invoke it in-process or through a one-shot CLI using the repository's Node 20, TypeScript, Zod, and `fs/promises` stack. It is not a new package or product: add no daemon, database, queue, scheduler, IPC protocol, global lock, or Ariadne graph state.

### State and atomicity

- Keep a separate append-only ledger per Orchestration Attempt at `.orchestration/attempts/<id>.jsonl`. Each closed-schema event carries its schema version, attempt ID, monotonic revision, time/correlation fields, and exact pins or owner pointers. Events cover attempt opening, dispatch intent, owner event/receipt pointers, and waiting or terminal status; they never copy owner payloads or maintain a second mutable workflow snapshot.
- Serialize only one attempt at a time: acquire its directory lock, verify the expected revision, recover at most an incomplete final JSONL record, validate the transition, rewrite through a same-directory temporary file, atomically rename on the same volume, then release the lock.
- Make dispatch intent durable before invoking an owner. Persist an owner outcome or waiting state in a second transaction. The contract claims process-crash atomicity only on the tested local, same-volume filesystem; power-loss durability remains unproven.
- Preserve direct Matt and Ariadne entry points. Reuse the existing storage algorithm where useful, but do not extend `AriadneHarnessController`: orchestration attempts are not epistemic graph state.

### Deletion and evidence boundary

The thin owner-artifact candidate remains mandatory, not rejected outright. Delete or inline `src/orchestration/` if the matched Rung 6 baseline satisfies every hard contract invariant. If the module survives, Rung 8 must still validate real crashes, stale locks, concurrent resumers, partial writes, and owner boundaries before any production-safety claim.

- [ADR 0012](../../../docs/adr/0012-colocated-neutral-orchestration-kernel.md) records the packaging boundary.
- [Throwaway prototype](../prototypes/13-kernel-packaging-substrate.throwaway.html) records the deterministic Rung 3 evidence.
- [`DEC-kernel-packaging-substrate`](../../../.ariadne/GRAPH.jsonl) records the accepted conditional decision.
- [`VAL-SELECT-kernel-packaging-substrate`](../../../.ariadne/GRAPH.jsonl) records the non-compensatory candidate selection.
