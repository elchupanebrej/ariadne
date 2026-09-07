# DEC-kernel-packaging-substrate: Co-locate an optional neutral orchestration kernel

- Status: DECIDED
- Provenance: DECIDED
- Type: DEC
- Revised: 2026-08-24

## Statement

If a kernel survives the matched thin-baseline evaluation, package it as one owner-neutral internal TypeScript module with its own per-attempt JSONL ledger and one-shot or in-process execution; do not extend AriadneHarnessController or add a package, service, or database.

## Payload

```json
{
  "dependencies": [
    "VAL-SELECT-kernel-packaging-substrate",
    "EVD-kernel-packaging-prototype-r3",
    "DEC-minimum-orchestration-contract",
    "DEC-runtime-safety-recovery-contract",
    "DEC-methodological-harness-lifecycle"
  ],
  "owner": "user",
  "hard_requirements": [
    "owner-neutral pointer-only attempt state",
    "durable dispatch intent before owner invocation",
    "expected-revision serialization across fresh local processes",
    "direct Matt and Ariadne use",
    "exact immutable pins",
    "independent deletion or inlining"
  ],
  "packaging": "one internal module in the existing package",
  "process_model": "in-process or one-shot CLI; no resident process",
  "technology": "Node 20, TypeScript, installed Zod, and node:fs/promises",
  "repository_location": "src/orchestration/ with state under .orchestration/attempts/<id>.jsonl",
  "ledger": "closed-schema append-only events containing schema version, attempt ID, monotonic revision, timestamps and correlation, exact pins, generic attempt status, dispatch intents, and owner pointers only",
  "atomicity": "per-attempt directory lock, expected revision, final-tail recovery, validated transition, same-directory temporary rewrite, and same-volume atomic rename",
  "exclusions": [
    "new package",
    "daemon",
    "database",
    "queue or scheduler",
    "IPC protocol",
    "global lock",
    "Ariadne graph storage for orchestration attempts",
    "copied owner payload or mutable workflow snapshot"
  ],
  "deletion_condition": "Delete or inline the module when the matched Rung 6 thin baseline satisfies every hard invariant.",
  "evidence_boundary": "Rung 3 supports the structural selection only; Rung 6 must establish runtime necessity and Rung 8 must test real crashes, locks, partial writes, and owner boundaries. No power-loss durability claim is made.",
  "adversarial_critique": [
    "The module duplicates GraphStorage mechanics; reuse its algorithm without merging state ownership, and extract a shared helper only after implementation demonstrates real duplication.",
    "The module may be unnecessary; the matched thin baseline is a mandatory deletion test, not a documentation caveat.",
    "Local file atomicity may fail under real faults or filesystems; Rung 8 must falsify the model before any production-safety claim."
  ],
  "accepted_on": "2026-08-22"
}
```
