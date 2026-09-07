# FRAME-kernel-packaging-substrate: Kernel packaging and substrate

- Status: RESOLVED
- Provenance: DECIDED
- Type: FRAME
- Revised: 2026-08-24

## Statement

A fresh host process must advance one pinned orchestration attempt atomically from repository-visible state without merging owner semantics or requiring a permanent service.

## Payload

```json
{
  "dependencies": [
    "OBS-existing-ariadne-harness-seam",
    "UNK-kernel-packaging-substrate",
    "DEC-methodological-harness-lifecycle"
  ],
  "context": "The repository is one Node 20 TypeScript package with Zod and a proven directory-lock plus atomic-rename JSONL pattern; its existing AriadneHarnessController is epistemic-owner infrastructure.",
  "required_behavior": "Given an attempt ID and expected revision, one process records or observes exactly one dispatch intent, validates exact pins and pointer-only owner receipts, returns a unique safe disposition after restart, and leaves direct Matt and Ariadne use untouched.",
  "proposed_mechanism": "Ticket 13 compares the thin baseline, Ariadne-controller reuse, a co-located neutral file kernel, and a standalone SQLite service.",
  "preconditions": [
    "trusted local host and repository filesystem",
    "exact Tested Release Bundle or equivalent pins",
    "owner adapter declarations and pointers"
  ],
  "postconditions": [
    "one revision-checked ledger transition is durable",
    "a competing or restarted process observes the same intent and does not redispatch",
    "unsupported or ambiguous state fails closed",
    "removing the kernel leaves owner tools usable"
  ],
  "invariants": [
    "no copied Method Contract, Matt workflow, Ariadne graph, permission, or human state",
    "no daemon, scheduler, queue, network transport, or database unless evidence requires one",
    "dispatch intent is durable before owner invocation",
    "attempts remain pinned",
    "kernel can be deleted or inlined"
  ],
  "constraints": [
    "reuse current Node TypeScript and Zod stack",
    "repository-visible state",
    "single-host v1",
    "Wayfinder produces a prototype and decision, not production implementation"
  ],
  "behavioral_delta": "GraphStorage demonstrates atomic local transactions, but only for Ariadne graph events; no neutral attempt ledger currently exists.",
  "perspectives": {
    "owner": "retains semantic and lifecycle authority",
    "host": "invokes one-shot operations and enforces permissions",
    "operator": "can inspect and recover repository files",
    "maintainer": "can delete one module and state directory if the baseline passes"
  },
  "unknowns": [],
  "contradictions": [
    "CTR-minimal-kernel-vs-atomic-continuity"
  ],
  "provenance": {
    "facts": "package.json, src/graph/storage.ts, src/harness/controller.ts, tickets 03 and 09-12",
    "requirement": "ticket 13"
  },
  "success_observer": "A reviewer can drive crash, concurrency, invalid-pin, direct-use, and deletion paths and falsify any candidate that loses unique disposition or owner neutrality."
}
```
