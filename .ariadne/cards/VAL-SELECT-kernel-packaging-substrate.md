# VAL-SELECT-kernel-packaging-substrate: Select co-located neutral file kernel conditionally

- Status: SELECTED
- Provenance: DECIDED
- Type: VAL-SELECT
- Revised: 2026-09-07

## Statement

Select a co-located owner-neutral TypeScript module with per-attempt JSONL and local file transactions if the matched thin baseline cannot satisfy the contract; reject Ariadne-controller reuse and a standalone service.

## Payload

```json
{
  "dependencies": [
    "SPACE-kernel-packaging-substrate",
    "EVD-kernel-packaging-prototype-r3"
  ],
  "hard_requirements": [
    "owner-neutral pointer-only state",
    "durable pre-dispatch intent",
    "fresh-process recovery",
    "concurrent-resumer serialization",
    "direct owner use",
    "exact pins",
    "no unproven infrastructure",
    "independent deletion or inlining"
  ],
  "candidate_results": {
    "CAN-thin-owner-artifact-baseline": "FAILS the structural atomic-intent requirement unless Rung 6 shows an equivalent host-native primitive; retained as deletion baseline",
    "CAN-ariadne-controller-kernel": "FAILS owner-neutral state and independent deletion",
    "CAN-colocated-neutral-file-kernel": "PASSES every modeled hard requirement at Rung 3",
    "CAN-standalone-sqlite-kernel": "FAILS no-unproven-infrastructure and independent deletion"
  },
  "preference_observations": {
    "code": "one internal module and one state directory",
    "dependencies": "Node standard library plus installed Zod",
    "process": "in-process or one-shot CLI",
    "storage": "one append-only JSONL ledger per attempt",
    "atomicity": "per-attempt directory lock, expected revision, temp rewrite, same-volume rename",
    "operations": "no daemon, scheduler, queue, database, IPC, or global lock",
    "deletion": "remove or inline src/orchestration and remove .orchestration after supported attempts retire"
  },
  "evidence_rung": 3,
  "assumptions": [
    "single trusted local filesystem provides same-volume atomic rename",
    "per-attempt concurrency is sufficient for v1",
    "owner adapters expose the receipts fixed by tickets 09 and 10"
  ],
  "unknowns": [
    "Rung 6 may show the thin baseline already satisfies every hard invariant",
    "Rung 8 may falsify the local file locking and recovery model"
  ],
  "adversarial_critique": [
    "The neutral module duplicates GraphStorage mechanics; response: reuse its proven algorithm, not its Ariadne schema or state owner, and extract a generic helper only if implementation shows real shared code.",
    "Per-attempt JSONL rewrites are O(n); response: attempt logs are bounded by finite replay budgets, and compaction is deferred until measured growth requires it.",
    "Stale lock cleanup can race a slow live process; response: Rung 8 must validate owner metadata and conservative stale-lock handling before production claims.",
    "The selected module may be unnecessary; response: the clean-session matched baseline deletes or inlines it whenever the thin arm passes."
  ],
  "selection": "CAN-colocated-neutral-file-kernel",
  "deferral": "Retain the module only if the matched Rung 6 thin baseline fails a hard invariant; real filesystem safety remains a Rung 8 claim.",
  "acceptance": "User accepted the prototype recommendation on 2026-08-22."
}
```
